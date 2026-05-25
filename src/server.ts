/**
 * Express production server.
 *
 * Serves:
 *   - /api/* → Express API routes
 *   - /*    → Static SPA assets from Vite build output
 *
 * Usage: node dist/server.js
 */

import express from "express";
import morgan from "morgan";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "url";

import { apiRouter } from "./api/index";

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled promise rejection:", reason);
});

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// ── Global middleware ────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
  // Vite dev server (localhost:5173) and API (127.0.0.1:PORT) are different origins
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });
}
app.use(express.json());

// ── API routes ───────────────────────────────────────────
app.use("/api", apiRouter);

// ── Static assets ─────────────────────────────────────────
const distDir = join(__dirname, "..");
app.use("/assets", express.static(join(distDir, "assets")));
app.use("/fonts", express.static(join(distDir, "fonts")));

// ── SPA fallback (all non-API, non-static routes serve index.html) ───
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  try {
    const html = readFileSync(join(distDir, "index.html"), "utf-8");
    res.type("html").send(html);
  } catch {
    res.status(404).json({ ok: false, error: "Not found" });
  }
});

const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.listen(PORT, () => {
  console.log(`[server] Starting Sidequests on http://127.0.0.1:${PORT}`);
});