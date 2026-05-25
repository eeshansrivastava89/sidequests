import { Router, Request, Response, NextFunction } from "express";

import { projectsRoute } from "./routes/projects";
import { projectByIdRoute } from "./routes/projects/[id]";
import { dismissAlertRoute } from "./routes/dismiss-alert";
import { refreshRoute } from "./routes/refresh";
import { settingsRoute } from "./routes/settings";
import { configRoute } from "./routes/config";
import { preflightRoute } from "./routes/preflight";
import { versionRoute } from "./routes/version";
import { focusRoute } from "./routes/focus";
import { visitRoute } from "./routes/visit";
import { shippedRoute } from "./routes/shipped";

// ── API router (mountable on any Express app) ────────────────
export const apiRouter = Router();

// ── Health check ─────────────────────────────────────────
apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────
apiRouter.use("/projects", projectsRoute);
apiRouter.use("/projects", projectByIdRoute);     // /:id, /:id/override, etc.
apiRouter.use("/projects", dismissAlertRoute);    // /:id/dismiss-alert
apiRouter.use("/refresh", refreshRoute);
apiRouter.use("/settings", settingsRoute);
apiRouter.use("/config", configRoute);
apiRouter.use("/preflight", preflightRoute);
apiRouter.use("/version", versionRoute);
apiRouter.use("/focus", focusRoute);
apiRouter.use("/visit", visitRoute);
apiRouter.use("/shipped", shippedRoute);

// ── 404 fallback ────────────────────────────────────────
apiRouter.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// ── Global error handler ─────────────────────────────────
apiRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const msg = err.message ?? String(err);

  // SQLite "no such table" → 503
  if (msg.includes("no such table") || msg.includes("SQLITE_ERROR")) {
    res.status(503).json({
      ok: false,
      error: "Database tables not found. Run `npm run setup` to initialize the database, then restart the dev server.",
    });
    return;
  }

  console.error(`[api] ${_req.method} ${_req.path}: ${msg}`);
  res.status(500).json({ ok: false, error: msg });
});