import { describe, it, expect } from "vitest";
import { parseSSE, reduceRefreshEvent, type RefreshState } from "@/hooks/use-refresh";

function makeActiveState(overrides: Partial<RefreshState> = {}): RefreshState {
  return {
    active: true,
    phase: "Scanning...",
    deterministicReady: false,
    projects: new Map(),
    summary: null,
    error: null,
    ...overrides,
  };
}

describe("parseSSE", () => {
  it("should parse a single SSE frame", () => {
    const result = parseSSE("event: enumerate_complete\ndata: {}\n\n");
    expect(result).toEqual([{ type: "enumerate_complete", data: "{}" }]);
  });

  it("should parse multiple SSE frames in one chunk", () => {
    const chunk =
      'event: enumerate_complete\ndata: {"projectCount":5}\n\n' +
      'event: project_start\ndata: {"name":"a","step":"store","index":0,"total":5}\n\n';
    const result = parseSSE(chunk);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("enumerate_complete");
    expect(result[1].type).toBe("project_start");
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
  it("enumerate_complete shows project count and pre-populates projects", () => {
    const state = makeActiveState();
    const next = reduceRefreshEvent(state, "enumerate_complete", '{"projectCount":3,"names":["a","b","c"]}');
    expect(next.phase).toBe("Found 3 projects. Scanning...");
    expect(next.projects.size).toBe(3);
    expect(next.projects.get("a")?.storeStatus).toBe("pending");
  });

  it("project_complete with step=store sets deterministicReady to true", () => {
    let state = makeActiveState();
    state = reduceRefreshEvent(state, "project_start", JSON.stringify({
      name: "my-app", step: "store", index: 0, total: 5,
    }));
    expect(state.deterministicReady).toBe(false);

    state = reduceRefreshEvent(state, "project_complete", JSON.stringify({
      name: "my-app", step: "store", detail: { status: "active" },
    }));
    expect(state.deterministicReady).toBe(true);
  });

  it("project_start with step=llm shows AI scanning phase", () => {
    const state = makeActiveState();
    const raw = JSON.stringify({ name: "my-app", step: "llm", index: 0, total: 5 });

    const next = reduceRefreshEvent(state, "project_start", raw);
    expect(next.phase).toBe("AI scanning my-app (1/5)");
  });

  it("project_start with step=store shows Scanning phase", () => {
    const state = makeActiveState();
    const raw = JSON.stringify({ name: "my-app", step: "store", index: 0, total: 5 });

    const next = reduceRefreshEvent(state, "project_start", raw);
    expect(next.phase).toBe("Scanning my-app (1/5)");
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

  it("enumerate_complete → project_start follows expected phase progression", () => {
    let state = makeActiveState();

    state = reduceRefreshEvent(state, "enumerate_complete", '{"projectCount":3,"names":["app-a","app-b","app-c"]}');
    expect(state.phase).toBe("Found 3 projects. Scanning...");

    state = reduceRefreshEvent(state, "project_start", JSON.stringify({
      name: "app-a", step: "store", index: 0, total: 3,
    }));
    expect(state.phase).toBe("Scanning app-a (1/3)");
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
