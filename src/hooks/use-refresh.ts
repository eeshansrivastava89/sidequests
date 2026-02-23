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
  llmFailedNames?: string[];
  llmSkipped?: number;
  durationMs?: number;
}

export interface ProjectProgress {
  name: string;
  storeStatus: "pending" | "running" | "done";
  llmStatus: "pending" | "running" | "done" | "error" | "skipped";
  llmError?: string;
  detail?: Record<string, unknown>;
  storeOrder?: number; // completion order for staggered animation
  llmDurationMs?: number; // how long the LLM call took
}

export interface RefreshState {
  active: boolean;
  phase: string;
  deterministicReady: boolean;
  skipLlm: boolean;
  projects: Map<string, ProjectProgress>;
  summary: RefreshEvent | null;
  error: string | null;
}

const INITIAL_STATE: RefreshState = {
  active: false,
  phase: "",
  deterministicReady: false,
  skipLlm: false,
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
    case "enumerate_complete": {
      const d = JSON.parse(raw);
      // Pre-populate all projects as "pending" so the activity log shows the full list
      const projects = new Map(state.projects);
      const names: string[] = d.names ?? [];
      for (const name of names) {
        if (!projects.has(name)) {
          projects.set(name, { name, storeStatus: "pending", llmStatus: "pending" });
        }
      }
      return { ...state, projects, phase: `Found ${d.projectCount} projects. Scanning...` };
    }
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
        ? `AI scanning ${d.name} (${d.index! + 1}/${d.total})`
        : `Scanning ${d.name} (${d.index! + 1}/${d.total})`;
      return { ...state, projects, phase };
    }
    case "project_complete": {
      const d: RefreshEvent = JSON.parse(raw);
      const projects = new Map(state.projects);
      const existing = projects.get(d.name!);
      if (existing) {
        if (d.step === "store") {
          existing.storeStatus = "done";
          existing.detail = d.detail;
          // Track completion order for staggered animation
          const doneCount = [...projects.values()].filter(p => p.storeStatus === "done").length;
          existing.storeOrder = doneCount;
        } else if (d.step === "llm") {
          existing.llmStatus = "done";
          if (d.detail) existing.detail = { ...existing.detail, ...d.detail };
          existing.llmDurationMs = (d.detail?.durationMs as number) ?? undefined;
        }
        projects.set(d.name!, existing);
      }
      // Set deterministicReady on first project_complete(store)
      const deterministicReady = d.step === "store" ? true : state.deterministicReady;
      return { ...state, projects, deterministicReady };
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
    setState((s) => reduceRefreshEvent(s, type, raw));
    // Refetch on every project_complete — natural stagger, no debounce needed
    if (type === "project_complete") {
      onComplete();
    }
    // Also refetch on first enumerate_complete for initial data
    if (type === "enumerate_complete" && !hydratedCoreRef.current) {
      hydratedCoreRef.current = true;
    }
  }, [onComplete]);

  const start = useCallback((options?: { skipLlm?: boolean }) => {
    if (state.active) return;

    const abort = new AbortController();
    abortRef.current = abort;
    hydratedCoreRef.current = false;

    setState({
      active: true,
      phase: "Connecting...",
      deterministicReady: false,
      skipLlm: !!options?.skipLlm,
      projects: new Map(),
      summary: null,
      error: null,
    });

    (async () => {
      let response: Response;
      const qs = options?.skipLlm ? "?skipLlm=true" : "";
      const connect = async () => fetch(`/api/refresh/stream${qs}`, { signal: abort.signal });
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
    // Explicitly tell the server to abort the pipeline
    fetch("/api/refresh/stream", { method: "POST" }).catch(() => {});
    // Immediately abort the client-side stream
    abortRef.current?.abort();
  }, []);

  return { state, start, cancel };
}
