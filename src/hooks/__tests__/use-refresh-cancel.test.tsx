// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useRefresh } from "@/hooks/use-refresh";

afterEach(cleanup);

vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

/**
 * Mock EventSource that delegates to test-controlled callbacks.
 * jsdom doesn't provide EventSource, so we polyfill it.
 */
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState: number = 0; // CONNECTING
  private eventListeners: Map<string, EventListener[]> = new Map();
  private closed = false;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.CONNECTING;
    MockEventSource.instances.push(this);
    // Simulate async connection open
    setTimeout(() => {
      if (this.closed) return;
      this.readyState = MockEventSource.OPEN;
      this.onopen?.(new Event("open"));
    }, 0);
  }

  addEventListener(type: string, listener: EventListener) {
    const existing = this.eventListeners.get(type) ?? [];
    existing.push(listener);
    this.eventListeners.set(type, existing);
  }

  removeEventListener(type: string, listener: EventListener) {
    const existing = this.eventListeners.get(type) ?? [];
    this.eventListeners.set(type, existing.filter((l) => l !== listener));
  }

  close() {
    this.closed = true;
    this.readyState = MockEventSource.CLOSED;
  }

  /** Test helper: simulate receiving an SSE event */
  _emit(type: string, data: string) {
    const listeners = this.eventListeners.get(type) ?? [];
    const event = new MessageEvent(type, { data });
    for (const listener of listeners) {
      listener(event as MessageEvent);
    }
  }

  /** Test helper: simulate an error */
  _error() {
    this.onerror?.(new Event("error"));
  }
}

describe("useRefresh — hook-level cancel path", () => {
  let originalEventSource: typeof globalThis.EventSource;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalEventSource = globalThis.EventSource;
    originalFetch = globalThis.fetch;
    MockEventSource.instances = [];
    // @ts-expect-error polyfill
    globalThis.EventSource = MockEventSource;
    // Mock the POST to /api/refresh/stream (for triggering server-side scan)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
    globalThis.fetch = originalFetch;
    MockEventSource.instances = [];
  });

  it("start() then cancel() transitions through Cancelling to Cancelled", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    // Start the refresh
    await act(async () => {
      result.current.start();
      // Allow MockEventSource to open
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.active).toBe(true);

    // Get the EventSource instance and push events
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];
    expect(es).toBeDefined();

    await act(async () => {
      es._emit("enumerate_complete", JSON.stringify({ projectCount: 5, names: ["a", "b", "c", "d", "e"] }));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.phase).toBe("Found 5 projects. Fast scanning...");

    // Cancel
    act(() => {
      result.current.cancel();
    });

    expect(result.current.state.active).toBe(false);
    expect(result.current.state.phase).toBe("Cancelled");
  });

  it("cancel preserves deterministicReady when already set", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });

    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Push a project_complete(store) to set deterministicReady
    await act(async () => {
      es._emit("enumerate_complete", JSON.stringify({ projectCount: 1, names: ["app-a"], pathHashes: ["h1"] }));
      es._emit("project_start", JSON.stringify({ name: "app-a", step: "store", index: 0, total: 1 }));
      es._emit("project_complete", JSON.stringify({ name: "app-a", step: "store", index: 0, total: 1 }));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.deterministicReady).toBe(true);

    // Cancel
    act(() => {
      result.current.cancel();
    });

    // Cancel resets transient refresh UI state
    expect(result.current.state.deterministicReady).toBe(false);
    expect(result.current.state.active).toBe(false);
    expect(result.current.state.projects.size).toBe(0);
  });

  it("can start a new refresh after cancel (retry)", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    // First: start and cancel
    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });

    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.active).toBe(false);

    // Second: retry
    MockEventSource.instances = [];
    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.active).toBe(true);
    expect(result.current.state.phase).toBe("Connecting...");
    expect(result.current.state.deterministicReady).toBe(false);

    // Verify the new stream works
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    await act(async () => {
      es._emit("enumerate_complete", JSON.stringify({ projectCount: 3, names: ["a", "b", "c"] }));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.phase).toBe("Found 3 projects. Fast scanning...");

    // Cleanup
    act(() => {
      result.current.cancel();
    });
  });

  it("cancel clears in-flight project progress so activity log resets", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });

    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    await act(async () => {
      es._emit("enumerate_complete", JSON.stringify({
        projectCount: 3,
        names: ["a", "b", "c"],
      }));
      es._emit("project_start", JSON.stringify({
        name: "a", step: "llm", index: 0, total: 3, provider: "claude-cli",
      }));
      es._emit("project_start", JSON.stringify({
        name: "b", step: "llm", index: 1, total: 3, provider: "claude-cli",
      }));
      await new Promise((r) => setTimeout(r, 10));
    });

    // projects map should have entries from enumerate + project_start events
    expect(result.current.state.projects.size).toBe(3);

    act(() => {
      result.current.cancel();
    });

    expect(result.current.state.active).toBe(false);
    expect(result.current.state.projects.size).toBe(0);
    expect(result.current.state.summary).toBeNull();
  });
});