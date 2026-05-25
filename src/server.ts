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
import cors from "cors";
import morgan from "morgan";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { apiRouter } from "./api/index";

const app = express();

// ── Global middleware ────────────────────────────────────
app.use(morgan("dev"));
app.use(cors({ origin: "*" }));
app.use(express.json());

// ── API routes ───────────────────────────────────────────
app.use("/api", apiRouter);

// ── Static assets ─────────────────────────────────────────
app.use("/assets", express.static(join(process.cwd(), "dist", "assets")));
app.use("/fonts", express.static(join(process.cwd(), "dist", "fonts")));

// ── SPA fallback (all non-API, non-static routes serve index.html) ───
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  try {
    const html = readFileSync(join(process.cwd(), "dist", "index.html"), "utf-8");
    res.type("html").send(html);
  } catch {
    res.status(404).json({ ok: false, error: "Not found" });
  }
});

const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.listen(PORT, () => {
  console.log(`[server] Starting Sidequests on http://127.0.0.1:${PORT}`);
});