import { Hono } from "hono";

export const configRoute = new Hono();

// GET /api/config — expose client-safe feature flags (no secrets)
// TODO: Return actual feature flags once defined (Phase 2+)
configRoute.get("/", (c) => {
  return c.json({});
});