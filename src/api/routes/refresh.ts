import { Hono } from "hono";
import { runRefreshPipeline } from "@/lib/pipeline";

export const refreshRoute = new Hono();

// POST /api/refresh — trigger pipeline synchronously (no SSE)
refreshRoute.post("/", async (c) => {
  const result = await runRefreshPipeline();
  return c.json({ ok: true, projectCount: result.projectCount });
});

// GET /api/refresh/stream — SSE streaming (Hono version)
// NOTE: This will be implemented in Phase 0b with Hono's streamSSE().
// For now, the synchronous POST above is available for basic testing.