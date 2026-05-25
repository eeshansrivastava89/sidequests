import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { runRefreshPipeline, type PipelineEvent } from "@/lib/pipeline";
import { clearSettingsCache } from "@/lib/settings";
import { getLlmProvider } from "@/lib/llm";

export const refreshRoute = new Hono();

// POST /api/refresh — trigger pipeline synchronously (no SSE)
refreshRoute.post("/", async (c) => {
  const result = await runRefreshPipeline();
  return c.json({ ok: true, projectCount: result.projectCount });
});

// POST /api/refresh/stream — cancel running pipeline
refreshRoute.post("/stream", async (c) => {
  if (pipelineAbort && pipelineRunning) {
    pipelineAbort.abort();
    return c.json({ ok: true, cancelled: true });
  }
  return c.json({ ok: true, cancelled: false });
});

// Pipeline state (module-level singleton, same as Next.js version)
let pipelineRunning = false;
let pipelineStartedAt = 0;
let pipelineAbort: AbortController | null = null;
const STALE_MS = 10 * 60 * 1000; // 10 minutes

// GET /api/refresh/stream — SSE streaming pipeline progress
refreshRoute.get("/stream", async (c) => {
  if (pipelineRunning && (Date.now() - pipelineStartedAt) < STALE_MS) {
    return c.json({ error: "Refresh already in progress" }, 409);
  }

  pipelineRunning = true;
  pipelineStartedAt = Date.now();

  // Ensure pipeline reads fresh settings
  clearSettingsCache();

  const abort = new AbortController();
  pipelineAbort = abort;

  const url = new URL(c.req.url);
  const forceSkipLlm = url.searchParams.get("skipLlm") === "true";
  const skipLlm = forceSkipLlm || getLlmProvider() === null;
  const namesParam = url.searchParams.get("names");
  const selectedNames = namesParam ? namesParam.split(",").filter(Boolean) : undefined;

  // Wire Hono request abort to pipeline abort
  c.req.raw.signal.addEventListener("abort", () => abort.abort());

  return streamSSE(c, async (stream) => {
    let pendingWrite: Promise<unknown> | null = null;

    function emit(event: PipelineEvent) {
      pendingWrite = stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    }

    async function flush() {
      if (pendingWrite) {
        await pendingWrite;
        pendingWrite = null;
      }
    }

    try {
      await runRefreshPipeline(emit, abort.signal, { skipLlm, selectedNames });
    } catch (err) {
      if (abort.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      await stream.writeSSE({
        event: "pipeline_error",
        data: JSON.stringify({ error: message }),
      });
    } finally {
      pipelineRunning = false;
      pipelineAbort = null;
      await flush();
    }
  });
});
