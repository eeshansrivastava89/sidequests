"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  projects: Map<string, ProjectProgress>;
  summary: RefreshEvent | null;
  error: string | null;
}

export function useRefresh(onComplete: () => void) {
  const [state, setState] = useState<RefreshState>({
    active: false,
    phase: "",
    projects: new Map(),
    summary: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(() => {
    if (state.active) return;

    const abort = new AbortController();
    abortRef.current = abort;

    setState({
      active: true,
      phase: "Connecting...",
      projects: new Map(),
      summary: null,
      error: null,
    });

    const eventSource = new EventSource("/api/refresh/stream");

    eventSource.addEventListener("scan_start", () => {
      setState((s) => ({ ...s, phase: "Scanning filesystem..." }));
    });

    eventSource.addEventListener("scan_complete", (e) => {
      const data = JSON.parse(e.data);
      setState((s) => ({ ...s, phase: `Found ${data.projectCount} projects. Deriving...` }));
    });

    eventSource.addEventListener("derive_start", () => {
      setState((s) => ({ ...s, phase: "Computing status and health scores..." }));
    });

    eventSource.addEventListener("derive_complete", () => {
      setState((s) => ({ ...s, phase: "Storing results..." }));
    });

    eventSource.addEventListener("project_start", (e) => {
      const data: RefreshEvent = JSON.parse(e.data);
      setState((s) => {
        const projects = new Map(s.projects);
        const existing = projects.get(data.name!) ?? {
          name: data.name!,
          storeStatus: "pending" as const,
          llmStatus: "pending" as const,
        };

        if (data.step === "store") {
          existing.storeStatus = "running";
        } else if (data.step === "llm") {
          existing.llmStatus = "running";
        }

        projects.set(data.name!, existing);
        const phase = data.step === "llm"
          ? `LLM enriching ${data.name} (${data.index! + 1}/${data.total})`
          : `Processing ${data.name} (${data.index! + 1}/${data.total})`;
        return { ...s, projects, phase };
      });
    });

    eventSource.addEventListener("project_complete", (e) => {
      const data: RefreshEvent = JSON.parse(e.data);
      setState((s) => {
        const projects = new Map(s.projects);
        const existing = projects.get(data.name!);
        if (existing) {
          if (data.step === "store") {
            existing.storeStatus = "done";
            existing.detail = data.detail;
          } else if (data.step === "llm") {
            existing.llmStatus = "done";
            if (data.detail) existing.detail = { ...existing.detail, ...data.detail };
          }
          projects.set(data.name!, existing);
        }
        return { ...s, projects };
      });
    });

    eventSource.addEventListener("project_error", (e) => {
      const data: RefreshEvent = JSON.parse(e.data);
      setState((s) => {
        const projects = new Map(s.projects);
        const existing = projects.get(data.name!);
        if (existing) {
          existing.llmStatus = "error";
          existing.llmError = data.error;
          projects.set(data.name!, existing);
        }
        return { ...s, projects };
      });
    });

    eventSource.addEventListener("done", (e) => {
      const data: RefreshEvent = JSON.parse(e.data);
      setState((s) => ({ ...s, active: false, phase: "Complete", summary: data }));
      eventSource.close();
      onComplete();
    });

    eventSource.addEventListener("pipeline_error", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setState((s) => ({ ...s, active: false, phase: "Error", error: data.error }));
      eventSource.close();
    });

    eventSource.addEventListener("error", () => {
      // Native SSE error — network disconnect or stream closed
      if (eventSource.readyState === EventSource.CLOSED) {
        setState((s) => {
          if (s.summary) return s; // Already completed normally
          return { ...s, active: false, phase: "Error", error: "Connection lost" };
        });
      }
    });

    // Cleanup on abort
    abort.signal.addEventListener("abort", () => {
      eventSource.close();
      setState((s) => ({ ...s, active: false, phase: "Cancelled" }));
    });
  }, [state.active, onComplete]);

  // Cleanup on unmount — close any open EventSource
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { state, start, cancel };
}
