// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useRefresh } from "@/hooks/use-refresh";

afterEach(cleanup);

/**
 * Creates a mock fetch that returns a ReadableStream which stays open
 * until explicitly closed, simulating a long-running SSE connection.
 */
function createMockSSEFetch() {
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();

  const mockFetch = vi.fn().mockImplementation(() => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    return Promise.resolve({
      ok: true,
      status: 200,
      body: stream,
    });
  });

  return {
    mockFetch,
    pushSSE(event: string, data: string) {
      if (streamController) {
        streamController.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }
    },
    closeStream() {
      try { streamController?.close(); } catch { /* already closed */ }
    },
  };
}

// Suppress "toast is not defined" type errors from sonner
vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

describe("useRefresh — hook-level cancel path", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("start() then cancel() transitions through Cancelling to Cancelled", async () => {
    const { mockFetch, pushSSE } = createMockSSEFetch();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    // Start the refresh
    await act(async () => {
      result.current.start();
    });

    // Should be active
    expect(result.current.state.active).toBe(true);

    // Push an enumerate_complete event to confirm stream is working
    await act(async () => {
      pushSSE("enumerate_complete", '{"projectCount":5,"names":["a","b","c","d","e"]}');
      // Give microtask queue time to process
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.phase).toBe("Found 5 projects. Scanning...");

    // Cancel
    act(() => {
      result.current.cancel();
    });

    // After cancel, phase should be "Cancelled" and active should be false
    // (cancel sets "Cancelling..." then abort listener fires immediately setting "Cancelled")
    expect(result.current.state.active).toBe(false);
    expect(result.current.state.phase).toBe("Cancelled");
  });

  it("cancel preserves deterministicReady when already set", async () => {
    const { mockFetch, pushSSE } = createMockSSEFetch();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    await act(async () => {
      result.current.start();
    });

    // Push a project_complete(store) to set deterministicReady
    await act(async () => {
      pushSSE("project_start", JSON.stringify({ name: "app-a", step: "store", index: 0, total: 1 }));
      pushSSE("project_complete", JSON.stringify({ name: "app-a", step: "store" }));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.deterministicReady).toBe(true);

    // Cancel
    act(() => {
      result.current.cancel();
    });

    // deterministicReady should be preserved
    expect(result.current.state.deterministicReady).toBe(true);
    expect(result.current.state.active).toBe(false);
  });

  it("can start a new refresh after cancel (retry)", async () => {
    const { mockFetch, pushSSE } = createMockSSEFetch();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    // First: start and cancel
    await act(async () => {
      result.current.start();
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.active).toBe(false);

    // Second: retry — create a fresh mock stream for the second call
    const { mockFetch: mockFetch2, pushSSE: pushSSE2 } = createMockSSEFetch();
    globalThis.fetch = mockFetch2 as unknown as typeof fetch;

    await act(async () => {
      result.current.start();
    });

    expect(result.current.state.active).toBe(true);
    expect(result.current.state.phase).toBe("Connecting...");
    expect(result.current.state.deterministicReady).toBe(false);

    // Verify the new stream works
    await act(async () => {
      pushSSE2("enumerate_complete", '{"projectCount":3}');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.state.phase).toBe("Found 3 projects. Scanning...");

    // Cleanup
    act(() => {
      result.current.cancel();
    });
  });
});
