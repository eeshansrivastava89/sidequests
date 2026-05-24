/**
 * Hono production server.
 *
 * Serves:
 *   - /api/* → Hono API routes
 *   - /*    → Static SPA assets from Vite build output
 *
 * Usage: node dist/server.js
 */

import { serve } from "@hono/node-server";
import { app } from "./api/index";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Resolve paths from APP_DATA_DIR (set by CLI launcher) or cwd
const DATA_DIR = process.env.APP_DATA_DIR ?? process.cwd();

// Serve Vite build assets (CSS, JS, fonts, etc.)
app.use("/assets/*", serveStatic({ root: "./dist" }));
app.use("/fonts/*", serveStatic({ root: "./dist" }));

// SPA fallback: all non-API routes serve index.html
app.get("*", async (c, next) => {
  // Skip API routes
  if (c.req.path.startsWith("/api")) return next();
  try {
    const html = readFileSync(join(process.cwd(), "dist", "index.html"), "utf-8");
    return c.html(html);
  } catch {
    return c.notFound();
  }
});

const PORT = parseInt(process.env.PORT ?? "3000", 10);

console.log(`[server] Starting Sidequests on http://127.0.0.1:${PORT}`);
serve({ fetch: app.fetch, port: PORT });