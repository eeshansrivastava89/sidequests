
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface RefreshEvent {
  type: string;
  name?: string;
  pathHash?: string;
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
  lastCommitDate?: string | null;
  provider?: string;
}

export interface ProjectProgress {
  name: string;
  storeStatus: "pending" | "running" | "done";
  llmStatus: "pending" | "running" | "done" | "error" | "skipped";
  llmError?: string;
  detail?: Record<string, unknown>;
  storeOrder?: number; // completion order for staggered animation
  llmDurationMs?: number; // how long the LLM call took
  lastCommitDate?: string | null; // for activity log sorting
  provider?: string; // which LLM provider processed this project
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

/** Parse complete SSE frames from a buffer.
 * Only processes blocks terminated by \n\n — the incomplete tail
 * is returned so the caller can prepend it to the next chunk.
 */
export function parseSSE(buffer: string): { events: Array<{ type: string; data: string }>; remainder: string } {
  const events: Array<{ type: string; data: string }> = [];
  const lastDoubleNewline = buffer.lastIndexOf("\n\n");

  // If no complete frame terminator, the entire buffer is incomplete
  if (lastDoubleNewline < 0) {
    return { events: [], remainder: buffer };
  }

  // Everything up to (and including) the last \n\n is complete
  const complete = buffer.slice(0, lastDoubleNewline + 2); // +2 to include \n\n
  const remainder = buffer.slice(lastDoubleNewline + 2);

  const blocks = complete.split("\n\n");
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

  return { events, remainder };
}

function getActiveProvider(projects: Map<string, ProjectProgress>, fallback?: string): string {
  if (fallback) return fallback;
  for (const project of projects.values()) {
    if (project.provider) return project.provider;
  }
  return "AI";
}

function buildLlmPhase(projects: Map<string, ProjectProgress>, provider?: string): string {
  const total = projects.size;
  const running = [...projects.values()].filter((p) => p.llmStatus === "running").length;
  const complete = [...projects.values()].filter((p) =>
    p.llmStatus === "done" || p.llmStatus === "error" || p.llmStatus === "skipped",
  ).length;
  const waiting = Math.max(total - running - complete, 0);
  const label = getActiveProvider(projects, provider);

  if (running > 0) {
    return `${label}: ${running} running | ${complete}/${total}`;
  }
  if (waiting > 0) {
    return `${label}: ${complete}/${total} | ${waiting} waiting`;
  }
  return `${label}: ${complete}/${total}`;
}

/** Pure state reducer for SSE events — testable without React. */
export function reduceRefreshEvent(state: RefreshState, type: string, raw: string): RefreshState {
  // Safety: if JSON parsing fails for any reason, don't crash — return unchanged state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let d: any;
  try {
    d = JSON.parse(raw);
  } catch {
    return state;
  }

  switch (type) {
    case "enumerate_complete": {
      // Pre-populate all projects as "pending" so the activity log shows the full list
      const projects = new Map(state.projects);
      const names: string[] = d.names ?? [];
      const pathHashes: string[] = d.pathHashes ?? [];
      for (let i = 0; i < names.length; i++) {
        const key = pathHashes[i] ?? names[i];
        if (!projects.has(key)) {
          projects.set(key, { name: names[i], storeStatus: "pending", llmStatus: "pending" });
        }
      }
      return { ...state, projects, phase: `Found ${d.projectCount} projects. Scanning...` };
    }
    case "project_start": {
      const projects = new Map(state.projects);
      const key = d.pathHash ?? d.name!;
      const existing = projects.get(key) ?? {
        name: d.name!,
        storeStatus: "pending" as const,
        llmStatus: "pending" as const,
        provider: undefined as string | undefined,
      };
      if (d.step === "store") existing.storeStatus = "running";
      else if (d.step === "llm") {
        existing.llmStatus = "running";
        existing.provider = d.provider as string | undefined ?? undefined;
      }
      projects.set(key, existing);
      const phase = d.step === "llm"
        ? buildLlmPhase(projects, d.provider)
        : `Scanning ${d.name} (${d.index! + 1}/${d.total})`;
      return { ...state, projects, phase };
    }
    case "project_complete": {
      const projects = new Map(state.projects);
      const key = d.pathHash ?? d.name!;
      const existing = projects.get(key);
      if (existing) {
        if (d.step === "store") {
          existing.storeStatus = "done";
          existing.detail = d.detail;
          existing.lastCommitDate = (d.lastCommitDate as string | null | undefined) ?? undefined;
          // Track completion order for staggered animation
          const doneCount = [...projects.values()].filter(p => p.storeStatus === "done").length;
          existing.storeOrder = doneCount;
        } else if (d.step === "llm") {
          existing.llmStatus = "done";
          if (d.detail) existing.detail = { ...existing.detail, ...d.detail };
          existing.llmDurationMs = (d.detail?.durationMs as number) ?? undefined;
          existing.provider = d.provider ?? existing.provider;
        }
        projects.set(key, existing);
      }
      // Set deterministicReady on first project_complete(store)
      const deterministicReady = d.step === "store" ? true : state.deterministicReady;
      const phase = d.step === "llm" ? buildLlmPhase(projects, d.provider) : state.phase;
      return { ...state, projects, deterministicReady, phase };
    }
    case "project_error": {
      const projects = new Map(state.projects);
      const key = d.pathHash ?? d.name!;
      const existing = projects.get(key);
      if (existing) {
        existing.llmStatus = "error";
        existing.llmError = d.error;
        existing.provider = d.provider ?? existing.provider;
        projects.set(key, existing);
      }
      return { ...state, projects, phase: buildLlmPhase(projects, d.provider) };
    }
    case "done": {
      return {
        ...state,
        active: false,
        phase: "Complete",
        deterministicReady: true,
        summary: d,
      };
    }
    case "pipeline_error": {
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

  const start = useCallback((options?: { skipLlm?: boolean; selectedNames?: string[] }) => {
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
      const params = new URLSearchParams();
      if (options?.skipLlm) params.set("skipLlm", "true");
      if (options?.selectedNames && options.selectedNames.length > 0) {
        params.set("names", options.selectedNames.join(","));
      }
      const qs = params.toString() ? `?${params.toString()}` : "";
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

          // Process only complete SSE frames; incomplete frames stay in the buffer
          const { events, remainder } = parseSSE(buffer);
          buffer = remainder;

          for (const frame of events) {
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
      setState({
        ...INITIAL_STATE,
        phase: "Cancelled",
      });
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
