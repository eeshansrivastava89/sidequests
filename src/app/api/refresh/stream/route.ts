import { runRefreshPipeline, type PipelineEvent } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "enrich";
  const skipLlm = mode === "scan";

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
