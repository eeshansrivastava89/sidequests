import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { projectsRoute } from "./routes/projects";
import { projectByIdRoute } from "./routes/projects/[id]";
import { refreshRoute } from "./routes/refresh";
import { settingsRoute } from "./routes/settings";
import { configRoute } from "./routes/config";
import { preflightRoute } from "./routes/preflight";
import { versionRoute } from "./routes/version";

export const app = new Hono();

// ── Global middleware ────────────────────────────────────
app.use("*", logger());
app.use("*", cors({ origin: "*" }));
// Note: no global timeout — SSE streaming for refresh can take minutes.
// Individual routes can set their own timeouts if needed.

// ── Health check ─────────────────────────────────────────
app.get("/api/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// ── Routes ───────────────────────────────────────────────
app.route("/api/projects", projectsRoute);
app.route("/api/projects", projectByIdRoute);   // /:id, /:id/override, etc.
app.route("/api/refresh", refreshRoute);
app.route("/api/settings", settingsRoute);
app.route("/api/config", configRoute);
app.route("/api/preflight", preflightRoute);
app.route("/api/version", versionRoute);

// ── 404 fallback ────────────────────────────────────────
app.notFound((c) => c.json({ ok: false, error: "Not found" }, 404));

// ── Global error handler ─────────────────────────────────
app.onError((err, c) => {
  const msg = err instanceof Error ? err.message : String(err);

  // SQLite "no such table" → 503
  if (msg.includes("no such table") || msg.includes("SQLITE_ERROR")) {
    return c.json(
      {
        ok: false,
        error:
          "Database tables not found. Run `npm run setup` to initialize the database, then restart the dev server.",
      },
      503,
    );
  }

  console.error(`[api] ${c.req.method} ${c.req.path}: ${msg}`);
  return c.json({ ok: false, error: msg }, 500);
});