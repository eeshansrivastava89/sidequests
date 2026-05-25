// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useRefresh } from "@/hooks/use-refresh";

afterEach(cleanup);

vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

/**
 * Mock EventSource for jsdom (which doesn't provide EventSource).
 */
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState: number = 0;
  private eventListeners: Map<string, EventListener[]> = new Map();
  private closed = false;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.CONNECTING;
    MockEventSource.instances.push(this);
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

  _emit(type: string, data: string) {
    const listeners = this.eventListeners.get(type) ?? [];
    const event = new MessageEvent(type, { data });
    for (const listener of listeners) {
      listener(event as MessageEvent);
    }
  }
}

describe("useRefresh — cancel→restart flow", () => {
  let originalEventSource: typeof globalThis.EventSource;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalEventSource = globalThis.EventSource;
    originalFetch = globalThis.fetch;
    MockEventSource.instances = [];
    // @ts-expect-error polyfill
    globalThis.EventSource = MockEventSource;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
    globalThis.fetch = originalFetch;
    MockEventSource.instances = [];
  });

  it("cancel sets active to false", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.state.active).toBe(true);

    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.active).toBe(false);
  });

  it("can restart after cancel (no stuck state)", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    // Start and cancel
    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.active).toBe(false);

    // Restart
    MockEventSource.instances = [];
    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.state.active).toBe(true);

    // Verify stream works
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];
    await act(async () => {
      es._emit("enumerate_complete", JSON.stringify({ projectCount: 3, names: ["a", "b", "c"] }));
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.state.phase).toBe("Found 3 projects. Fast scanning...");

    act(() => {
      result.current.cancel();
    });
  });

  it("handles EventSource error by resetting state", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    await act(async () => {
      result.current.start();
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.state.active).toBe(true);

    // Simulate EventSource error
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];
    act(() => {
      es.onerror?.(new Event("error"));
    });

    // Should reset to inactive with error phase
    expect(result.current.state.active).toBe(false);
    expect(result.current.state.phase).toBe("Error");
  });
});