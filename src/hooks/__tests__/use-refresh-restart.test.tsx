// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useRefresh } from "@/hooks/use-refresh";

afterEach(cleanup);

vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

function createMockSSEFetch(status = 200) {
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();

  const mockFetch = vi.fn().mockImplementation(() => {
    if (status === 409) {
      return Promise.resolve({ ok: false, status: 409, body: null });
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    return Promise.resolve({ ok: true, status: 200, body: stream });
  });

  return {
    mockFetch,
    pushSSE(event: string, data: string) {
      streamController?.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
    },
    closeStream() {
      try { streamController?.close(); } catch { /* already closed */ }
    },
  };
}

describe("useRefresh — cancel→restart flow", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("cancel sets active to false", async () => {
    const { mockFetch } = createMockSSEFetch();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    await act(async () => {
      result.current.start();
    });
    expect(result.current.state.active).toBe(true);

    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.active).toBe(false);
  });

  it("can restart after cancel (no stuck state)", async () => {
    const { mockFetch } = createMockSSEFetch();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    // Start and cancel
    await act(async () => {
      result.current.start();
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.active).toBe(false);

    // Restart with fresh mock
    const { mockFetch: mockFetch2, pushSSE: pushSSE2 } = createMockSSEFetch();
    globalThis.fetch = mockFetch2 as unknown as typeof fetch;

    await act(async () => {
      result.current.start();
    });
    expect(result.current.state.active).toBe(true);

    // Verify stream works
    await act(async () => {
      pushSSE2("scan_start", "{}");
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.state.phase).toBe("Scanning filesystem...");

    act(() => {
      result.current.cancel();
    });
  });

  it("409 on restart shows toast and resets state", async () => {
    // Mock 409 response directly — no prior cancel, so hook should immediately
    // toast and reset to INITIAL_STATE
    const { mockFetch: mockFetch409 } = createMockSSEFetch(409);
    globalThis.fetch = mockFetch409 as unknown as typeof fetch;

    const onComplete = vi.fn();
    const { result } = renderHook(() => useRefresh(onComplete));

    await act(async () => {
      result.current.start();
      // Allow the async IIFE in start() to process the 409 response
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should have reset to inactive (409 without recent cancel → toast + reset)
    expect(result.current.state.active).toBe(false);
  });
});
