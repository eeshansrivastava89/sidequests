import { Router } from "express";
import { runRefreshPipeline, type PipelineEvent } from "@/lib/pipeline";
import { clearSettingsCache } from "@/lib/settings";
import { getLlmProvider } from "@/lib/llm";

export const refreshRoute = Router();

const STALE_MS = 10 * 60 * 1000; // 10 minutes

/** Encapsulates pipeline lifecycle state — avoids module-level mutable vars. */
class PipelineSession {
  private running = false;
  private startedAt = 0;
  private abort: AbortController | null = null;

  get isActive(): boolean {
    return this.running && (Date.now() - this.startedAt) < STALE_MS;
  }

  start(): AbortController {
    this.running = true;
    this.startedAt = Date.now();
    const abort = new AbortController();
    this.abort = abort;
    return abort;
  }

  cancel(): boolean {
    if (this.abort && this.running) {
      this.abort.abort();
      this.reset();
      return true;
    }
    return false;
  }

  reset(): void {
    this.running = false;
    this.abort = null;
  }
}

const session = new PipelineSession();

// POST /api/refresh — trigger pipeline synchronously (no SSE)
refreshRoute.post("/", async (_req, res) => {
  const result = await runRefreshPipeline();
  res.json({ ok: true, projectCount: result.projectCount });
});

// POST /api/refresh/stream — cancel running pipeline
refreshRoute.post("/stream", async (_req, res) => {
  res.json({ ok: true, cancelled: session.cancel() });
});

// GET /api/refresh/stream — SSE streaming pipeline progress
refreshRoute.get("/stream", async (req, res) => {
  if (session.isActive) {
    res.status(409).json({ error: "Refresh already in progress" });
    return;
  }

  // Ensure pipeline reads fresh settings
  clearSettingsCache();

  const abort = session.start();

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

  async function emit(event: PipelineEvent) {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    await new Promise((resolve) => setImmediate(resolve));
  }

  // Wire client disconnect to pipeline abort
  req.on("close", () => {
    abort.abort();
    session.reset();
  });

  try {
    await runRefreshPipeline(emit, abort.signal, { skipLlm, selectedNames });
  } catch (err) {
    if (abort.signal.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    res.write(`event: pipeline_error\ndata: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    session.reset();
    res.end();
  }
});