import { Hono } from "hono";
import { config } from "@/lib/config";

export const configRoute = new Hono();

// GET /api/config — expose client-safe feature flags (no secrets)
configRoute.get("/", (c) => {
  return c.json({});
});