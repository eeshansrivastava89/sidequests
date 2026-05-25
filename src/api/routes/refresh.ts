import { Router } from "express";
import { runRefreshPipeline, type PipelineEvent } from "@/lib/pipeline";
import { clearSettingsCache } from "@/lib/settings";
import { getLlmProvider } from "@/lib/llm";

export const refreshRoute = Router();

// POST /api/refresh — trigger pipeline synchronously (no SSE)
refreshRoute.post("/", async (_req, res) => {
  const result = await runRefreshPipeline();
  res.json({ ok: true, projectCount: result.projectCount });
});

// POST /api/refresh/stream — cancel running pipeline
refreshRoute.post("/stream", async (_req, res) => {
  if (pipelineAbort && pipelineRunning) {
    pipelineAbort.abort();
    res.json({ ok: true, cancelled: true });
    return;
  }
  res.json({ ok: true, cancelled: false });
});

// Pipeline state (module-level singleton)
let pipelineRunning = false;
let pipelineStartedAt = 0;
let pipelineAbort: AbortController | null = null;
const STALE_MS = 10 * 60 * 1000; // 10 minutes

// GET /api/refresh/stream — SSE streaming pipeline progress
refreshRoute.get("/stream", async (req, res) => {
  if (pipelineRunning && (Date.now() - pipelineStartedAt) < STALE_MS) {
    res.status(409).json({ error: "Refresh already in progress" });
    return;
  }

  pipelineRunning = true;
  pipelineStartedAt = Date.now();

  // Ensure pipeline reads fresh settings
  clearSettingsCache();

  const abort = new AbortController();
  pipelineAbort = abort;

  const forceSkipLlm = req.query.skipLlm === "true";
  const skipLlm = forceSkipLlm || getLlmProvider() === null;
  const namesParam = req.query.names as string | undefined;
  const selectedNames = namesParam ? namesParam.split(",").filter(Boolean) : undefined;

  // Set SSE headers immediately and flush — no buffering
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  // Disable Nagle's algorithm — send each write immediately
  if (res.socket) res.socket.setNoDelay(true);

  // Emit an SSE event to the client.
  // Yields to the event loop after each write so Node.js can flush
  // the TCP send buffer before the next blocking operation (e.g. execFileSync).
  // Without this yield, synchronous CPU work (git commands, DB writes)
  // starves the event loop and batches all SSE events into one packet.
  async function emit(event: PipelineEvent) {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    // Yield to the event loop — lets Node.js flush the write buffer to the network
    await new Promise((resolve) => setImmediate(resolve));
  }

  // Wire client disconnect to pipeline abort
  req.on("close", () => {
    abort.abort();
    pipelineRunning = false;
    pipelineAbort = null;
  });

  try {
    await runRefreshPipeline(emit, abort.signal, { skipLlm, selectedNames });
  } catch (err) {
    if (abort.signal.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    res.write(`event: pipeline_error\ndata: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    pipelineRunning = false;
    pipelineAbort = null;
    res.end();
  }
});