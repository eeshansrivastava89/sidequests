"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface RefreshEvent {
  type: string;
  name?: string;
  index?: number;
  total?: number;
  step?: string;
  detail?: Record<string, unknown>;
  error?: string;
  projectCount?: number;
  llmSucceeded?: number;
  llmFailed?: number;
  llmSkipped?: number;
  durationMs?: number;
}

export interface ProjectProgress {
  name: string;
  storeStatus: "pending" | "running" | "done";
  llmStatus: "pending" | "running" | "done" | "error" | "skipped";
  llmError?: string;
  detail?: Record<string, unknown>;
}

export interface RefreshState {
  active: boolean;
  phase: string;
  deterministicReady: boolean;
  projects: Map<string, ProjectProgress>;
  summary: RefreshEvent | null;
  error: string | null;
}

const INITIAL_STATE: RefreshState = {
  active: false,
  phase: "",
  deterministicReady: false,
  projects: new Map(),
  summary: null,
  error: null,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse a single SSE frame: "event: <type>\ndata: <json>\n\n" */
export function parseSSE(chunk: string): Array<{ type: string; data: string }> {
  const events: Array<{ type: string; data: string }> = [];
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    let type = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) type = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (data) events.push({ type, data });
  }
  return events;
}

/** Pure state reducer for SSE events — testable without React. */
export function reduceRefreshEvent(state: RefreshState, type: string, raw: string): RefreshState {
  switch (type) {
    case "scan_start":
      return { ...state, phase: "Scanning filesystem..." };
    case "scan_complete": {
      const d = JSON.parse(raw);
      return { ...state, phase: `Found ${d.projectCount} projects. Deriving...` };
    }
    case "derive_start":
      return { ...state, phase: "Computing status and health scores..." };
    case "derive_complete":
      return { ...state, phase: "Saving scan results..." };
    case "github_start":
      return { ...state, phase: "Syncing GitHub data..." };
    case "github_complete":
      return {
        ...state,
        deterministicReady: true,
        phase: "Core scan complete. LLM enrichment continues in background...",
      };
    case "project_start": {
      const d: RefreshEvent = JSON.parse(raw);
      const projects = new Map(state.projects);
      const existing = projects.get(d.name!) ?? {
        name: d.name!,
        storeStatus: "pending" as const,
        llmStatus: "pending" as const,
      };
      if (d.step === "store") existing.storeStatus = "running";
      else if (d.step === "llm") existing.llmStatus = "running";
      projects.set(d.name!, existing);
      const phase = d.step === "llm"
        ? `Enriching ${d.name} (${d.index! + 1}/${d.total})`
        : `Processing ${d.name} (${d.index! + 1}/${d.total})`;
      const deterministicReady = d.step === "llm" ? true : state.deterministicReady;
      return { ...state, projects, phase, deterministicReady };
    }
    case "project_complete": {
      const d: RefreshEvent = JSON.parse(raw);
      const projects = new Map(state.projects);
      const existing = projects.get(d.name!);
      if (existing) {
        if (d.step === "store") {
          existing.storeStatus = "done";
          existing.detail = d.detail;
        } else if (d.step === "llm") {
          existing.llmStatus = "done";
          if (d.detail) existing.detail = { ...existing.detail, ...d.detail };
        }
        projects.set(d.name!, existing);
      }
      return { ...state, projects };
    }
    case "project_error": {
      const d: RefreshEvent = JSON.parse(raw);
      const projects = new Map(state.projects);
      const existing = projects.get(d.name!);
      if (existing) {
        existing.llmStatus = "error";
        existing.llmError = d.error;
        projects.set(d.name!, existing);
      }
      return { ...state, projects };
    }
    case "done": {
      const d: RefreshEvent = JSON.parse(raw);
      return {
        ...state,
        active: false,
        phase: "Complete",
        deterministicReady: true,
        summary: d,
      };
    }
    case "pipeline_error": {
      const d = JSON.parse(raw);
      return { ...state, active: false, phase: "Error", error: d.error };
    }
    default:
      return state;
  }
}

export function useRefresh(onComplete: () => void) {
  const [state, setState] = useState<RefreshState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedCoreRef = useRef(false);
  const cancelRequestedAtRef = useRef(0);

  const handleEvent = useCallback((type: string, raw: string) => {
    setState((s) => {
      const next = reduceRefreshEvent(s, type, raw);
      return next;
    });
    if (type === "github_complete" && !hydratedCoreRef.current) {
      hydratedCoreRef.current = true;
      onComplete();
    }
  }, [onComplete]);

  const start = useCallback(() => {
    if (state.active) return;

    const abort = new AbortController();
    abortRef.current = abort;
    hydratedCoreRef.current = false;

    setState({
      active: true,
      phase: "Connecting...",
      deterministicReady: false,
      projects: new Map(),
      summary: null,
      error: null,
    });

    (async () => {
      let response: Response;
      const connect = async () => fetch("/api/refresh/stream", { signal: abort.signal });
      try {
        response = await connect();
      } catch {
        if (abort.signal.aborted) return;
        setState((s) => ({ ...s, active: false, phase: "Error", error: "Connection failed" }));
        return;
      }

      if (response.status === 409) {
        const recentlyCancelled = Date.now() - cancelRequestedAtRef.current < 20_000;
        if (recentlyCancelled) {
          setState((s) => ({ ...s, phase: "Waiting for previous refresh to stop..." }));
          for (let i = 0; i < 40; i++) {
            await sleep(500);
            if (abort.signal.aborted) return;
            try {
              response = await connect();
            } catch {
              if (abort.signal.aborted) return;
              setState((s) => ({ ...s, active: false, phase: "Error", error: "Connection failed" }));
              return;
            }
            if (response.status !== 409) break;
          }
        }
        if (response.status === 409) {
          setState(INITIAL_STATE);
          toast.info("Refresh already in progress");
          return;
        }
      }

      if (!response.ok || !response.body) {
        setState((s) => ({ ...s, active: false, phase: "Error", error: `Server error (${response.status})` }));
        return;
      }
      cancelRequestedAtRef.current = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE frames (delimited by \n\n)
          const frames = parseSSE(buffer);
          // Keep any trailing incomplete frame in the buffer
          const lastDoubleNewline = buffer.lastIndexOf("\n\n");
          buffer = lastDoubleNewline >= 0 ? buffer.slice(lastDoubleNewline + 2) : buffer;

          for (const frame of frames) {
            try {
              handleEvent(frame.type, frame.data);
            } catch {
              // Ignore malformed SSE frames
            }
            if (frame.type === "done") completed = true;
          }
        }
      } catch {
        if (abort.signal.aborted) return;
        setState((s) => {
          if (s.summary) return s;
          return { ...s, active: false, phase: "Error", error: "Connection lost" };
        });
        return;
      }

      if (completed) {
        onComplete();
      }
    })();

    // Cleanup on abort
    abort.signal.addEventListener("abort", () => {
      setState((s) => ({ ...s, active: false, phase: "Cancelled" }));
    });
  }, [state.active, onComplete, handleEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    cancelRequestedAtRef.current = Date.now();
    setState((s) => ({ ...s, phase: "Cancelling..." }));
    abortRef.current?.abort();
  }, []);

  return { state, start, cancel };
}
