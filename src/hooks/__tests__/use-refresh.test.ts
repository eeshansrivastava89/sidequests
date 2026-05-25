import { describe, it, expect } from "vitest";
import { parseSSE, reduceRefreshEvent, type RefreshState } from "@/hooks/use-refresh";

function makeActiveState(overrides: Partial<RefreshState> = {}): RefreshState {
  return {
    active: true,
    phase: "Fast scanning...",
    deterministicReady: false,
    skipLlm: false,
    projects: new Map(),
    summary: null,
    error: null,
    ...overrides,
  };
}

describe("parseSSE", () => {
  it("should parse a single SSE frame", () => {
    const result = parseSSE("event: enumerate_complete\ndata: {}\n\n");
    expect(result.events).toEqual([{ type: "enumerate_complete", data: "{}" }]);
    expect(result.remainder).toBe("");
  });

  it("should parse multiple SSE frames in one chunk", () => {
    const chunk =
      'event: enumerate_complete\ndata: {"projectCount":5}\n\n' +
      'event: project_start\ndata: {"name":"a","step":"store","index":0,"total":5}\n\n';
    const result = parseSSE(chunk);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe("enumerate_complete");
    expect(result.events[1].type).toBe("project_start");
    expect(result.remainder).toBe("");
  });

  it("should default event type to 'message' when missing", () => {
    const result = parseSSE('data: {"hello":true}\n\n');
    expect(result.events).toEqual([{ type: "message", data: '{"hello":true}' }]);
    expect(result.remainder).toBe("");
  });

  it("should return empty events for empty/whitespace input", () => {
    expect(parseSSE("").events).toEqual([]);
    expect(parseSSE("  \n\n  ").events).toEqual([]);
  });

  it("should ignore blocks without data lines", () => {
    expect(parseSSE("event: heartbeat\n\n").events).toEqual([]);
  });

  it("should keep incomplete frames in remainder (no trailing double newline)", () => {
    const result = parseSSE('event: done\ndata: {"projectCount":3}');
    expect(result.events).toEqual([]);
    expect(result.remainder).toBe('event: done\ndata: {"projectCount":3}');
  });
});

describe("reduceRefreshEvent — state transitions", () => {
  it("enumerate_complete shows project count and pre-populates projects", () => {
    const state = makeActiveState();
    const next = reduceRefreshEvent(state, "enumerate_complete", '{"projectCount":3,"names":["a","b","c"]}');
    expect(next.phase).toBe("Found 3 projects. Fast scanning...");
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

  it("project_start with step=llm shows AI enriching phase", () => {
    const state = makeActiveState();
    const raw = JSON.stringify({ name: "my-app", step: "llm", index: 0, total: 5 });

    const next = reduceRefreshEvent(state, "project_start", raw);
    expect(next.phase).toBe("AI: 1 running | 0/1");
  });

  it("project_start with step=llm shows provider name when present", () => {
    const state = makeActiveState();
    const raw = JSON.stringify({ name: "my-app", step: "llm", index: 0, total: 5, provider: "qwen-cli" });

    const next = reduceRefreshEvent(state, "project_start", raw);
    expect(next.phase).toBe("qwen-cli: 1 running | 0/1");
  });

  it("project_start with step=store shows Fast scanning phase", () => {
    const state = makeActiveState();
    const raw = JSON.stringify({ name: "my-app", step: "store", index: 0, total: 5 });

    const next = reduceRefreshEvent(state, "project_start", raw);
    expect(next.phase).toBe("Fast scanning my-app (1/5)");
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
    expect(state.phase).toBe("Found 3 projects. Fast scanning...");

    state = reduceRefreshEvent(state, "project_start", JSON.stringify({
      name: "app-a", step: "store", index: 0, total: 3,
    }));
    expect(state.phase).toBe("Fast scanning app-a (1/3)");
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
    expect(state.phase).toBe("AI: 1/1");
  });

  it("llm phase text aggregates concurrent progress", () => {
    let state = makeActiveState();
    state = reduceRefreshEvent(state, "enumerate_complete", JSON.stringify({
      projectCount: 3,
      names: ["app-a", "app-b", "app-c"],
    }));

    state = reduceRefreshEvent(state, "project_start", JSON.stringify({
      name: "app-a", step: "llm", index: 0, total: 3, provider: "claude-cli",
    }));
    state = reduceRefreshEvent(state, "project_start", JSON.stringify({
      name: "app-b", step: "llm", index: 1, total: 3, provider: "claude-cli",
    }));
    expect(state.phase).toBe("claude-cli: 2 running | 0/3");

    state = reduceRefreshEvent(state, "project_complete", JSON.stringify({
      name: "app-a", step: "llm", provider: "claude-cli",
    }));
    expect(state.phase).toBe("claude-cli: 1 running | 1/3");
  });

  it("unknown event type returns state unchanged", () => {
    const state = makeActiveState();
    const next = reduceRefreshEvent(state, "unknown_event", "{}");
    expect(next).toEqual(state);
  });
});
// Cancel-path tests moved to use-refresh-cancel.test.tsx (hook-level via renderHook)
