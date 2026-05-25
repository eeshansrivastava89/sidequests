import { Router } from "express";

export const configRoute = Router();

// GET /api/config — expose client-safe feature flags (no secrets)
// TODO: Return actual feature flags once defined (Phase 2+)
configRoute.get("/", (_req, res) => {
  res.json({});
});