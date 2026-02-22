import { describe, it, expect } from "vitest";
import { parseSSE, reduceRefreshEvent, type RefreshState } from "@/hooks/use-refresh";

function makeActiveState(overrides: Partial<RefreshState> = {}): RefreshState {
  return {
    active: true,
    phase: "Scanning filesystem...",
    deterministicReady: false,
    projects: new Map(),
    summary: null,
    error: null,
    ...overrides,
  };
}

describe("parseSSE", () => {
  it("should parse a single SSE frame", () => {
    const result = parseSSE("event: scan_start\ndata: {}\n\n");
    expect(result).toEqual([{ type: "scan_start", data: "{}" }]);
  });

  it("should parse multiple SSE frames in one chunk", () => {
    const chunk =
      "event: scan_start\ndata: {}\n\n" +
      'event: scan_complete\ndata: {"projectCount":5}\n\n';
    const result = parseSSE(chunk);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("scan_start");
    expect(result[1].type).toBe("scan_complete");
  });

  it("should default event type to 'message' when missing", () => {
    const result = parseSSE('data: {"hello":true}\n\n');
    expect(result).toEqual([{ type: "message", data: '{"hello":true}' }]);
  });

  it("should return empty array for empty/whitespace input", () => {
    expect(parseSSE("")).toEqual([]);
    expect(parseSSE("  \n\n  ")).toEqual([]);
  });

  it("should ignore blocks without data lines", () => {
    expect(parseSSE("event: heartbeat\n\n")).toEqual([]);
  });

  it("should handle incomplete frames (no trailing double newline)", () => {
    const result = parseSSE('event: done\ndata: {"projectCount":3}');
    expect(result).toEqual([{ type: "done", data: '{"projectCount":3}' }]);
  });
});

describe("reduceRefreshEvent — state transitions", () => {
  it("github_complete sets deterministicReady to true", () => {
    const state = makeActiveState();
    expect(state.deterministicReady).toBe(false);

    const next = reduceRefreshEvent(state, "github_complete", '{"durationMs":1200}');
    expect(next.deterministicReady).toBe(true);
    expect(next.phase).toContain("Fast scan complete");
  });

  it("project_start with step=llm sets deterministicReady to true", () => {
    const state = makeActiveState();
    const raw = JSON.stringify({ name: "my-app", step: "llm", index: 0, total: 5 });

    const next = reduceRefreshEvent(state, "project_start", raw);
    expect(next.deterministicReady).toBe(true);
    expect(next.phase).toBe("AI scanning my-app (1/5)");
  });

  it("project_start with step=store does NOT set deterministicReady", () => {
    const state = makeActiveState();
    const raw = JSON.stringify({ name: "my-app", step: "store", index: 0, total: 5 });

    const next = reduceRefreshEvent(state, "project_start", raw);
    expect(next.deterministicReady).toBe(false);
    expect(next.phase).toBe("Processing my-app (1/5)");
  });

  it("done event finalizes state: active=false, deterministicReady=true, summary set", () => {
    const state = makeActiveState({ deterministicReady: true });
    const raw = JSON.stringify({ projectCount: 10, llmSucceeded: 8, llmFailed: 2 });

    const next = reduceRefreshEvent(state, "done", raw);
    expect(next.active).toBe(false);
    expect(next.phase).toBe("Complete");
    expect(next.deterministicReady).toBe(true);
    expect(next.summary).not.toBeNull();
    expect(next.summary!.projectCount).toBe(10);
  });

  it("pipeline_error sets active=false and error message", () => {
    const state = makeActiveState();
    const raw = JSON.stringify({ error: "Connection lost" });

    const next = reduceRefreshEvent(state, "pipeline_error", raw);
    expect(next.active).toBe(false);
    expect(next.phase).toBe("Error");
    expect(next.error).toBe("Connection lost");
  });

  it("scan_start → scan_complete → derive_start follows expected phase progression", () => {
    let state = makeActiveState();

    state = reduceRefreshEvent(state, "scan_start", "{}");
    expect(state.phase).toBe("Scanning filesystem...");

    state = reduceRefreshEvent(state, "scan_complete", '{"projectCount":3}');
    expect(state.phase).toBe("Found 3 projects. Deriving...");

    state = reduceRefreshEvent(state, "derive_start", "{}");
    expect(state.phase).toBe("Computing status and health scores...");

    state = reduceRefreshEvent(state, "derive_complete", "{}");
    expect(state.phase).toBe("Saving scan results...");
  });

  it("project_complete updates project status correctly", () => {
    // First set up a project via project_start
    let state = makeActiveState();
    state = reduceRefreshEvent(state, "project_start", JSON.stringify({
      name: "app-a", step: "store", index: 0, total: 2,
    }));
    expect(state.projects.get("app-a")?.storeStatus).toBe("running");

    // Complete the store step
    state = reduceRefreshEvent(state, "project_complete", JSON.stringify({
      name: "app-a", step: "store", detail: { loc: 5000 },
    }));
    expect(state.projects.get("app-a")?.storeStatus).toBe("done");
    expect(state.projects.get("app-a")?.detail).toEqual({ loc: 5000 });
  });

  it("project_error sets llmStatus to error", () => {
    let state = makeActiveState();
    state = reduceRefreshEvent(state, "project_start", JSON.stringify({
      name: "app-b", step: "llm", index: 0, total: 1,
    }));

    state = reduceRefreshEvent(state, "project_error", JSON.stringify({
      name: "app-b", error: "Rate limited",
    }));
    expect(state.projects.get("app-b")?.llmStatus).toBe("error");
    expect(state.projects.get("app-b")?.llmError).toBe("Rate limited");
  });

  it("unknown event type returns state unchanged", () => {
    const state = makeActiveState();
    const next = reduceRefreshEvent(state, "unknown_event", "{}");
    expect(next).toEqual(state);
  });
});
// Cancel-path tests moved to use-refresh-cancel.test.tsx (hook-level via renderHook)
