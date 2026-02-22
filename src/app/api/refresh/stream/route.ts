import { runRefreshPipeline, type PipelineEvent } from "@/lib/pipeline";
import { clearSettingsCache } from "@/lib/settings";
import { getLlmProvider } from "@/lib/llm";

export const dynamic = "force-dynamic";

let pipelineRunning = false;
let pipelineStartedAt = 0;
const STALE_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(request: Request) {
  if (pipelineRunning && (Date.now() - pipelineStartedAt) < STALE_MS) {
    return new Response(JSON.stringify({ error: "Refresh already in progress" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  pipelineRunning = true;
  pipelineStartedAt = Date.now();

  // Ensure pipeline reads fresh settings (user may have changed them via UI)
  clearSettingsCache();

  const encoder = new TextEncoder();
  const abort = new AbortController();
  const url = new URL(request.url);
  const forceSkipLlm = url.searchParams.get("skipLlm") === "true";
  const skipLlm = forceSkipLlm || getLlmProvider() === null;

  // Wire client disconnect to abort signal
  request.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: PipelineEvent) {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream closed by client
        }
      }

      try {
        await runRefreshPipeline(emit, abort.signal, { skipLlm });
      } catch (err) {
        if (abort.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        const errorEvent = `event: pipeline_error\ndata: ${JSON.stringify({ error: message })}\n\n`;
        try {
          controller.enqueue(encoder.encode(errorEvent));
        } catch {
          // Stream closed
        }
      } finally {
        pipelineRunning = false;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
