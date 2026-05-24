#!/usr/bin/env node

/**
 * Dev entry point for Sidequests.
 *
 * Handles the same setup as cli.mjs (find free port, bootstrap DB, start server)
 * then starts Vite for hot module replacement.
 *
 * Usage: npm run dev [-- --port <n>]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fork } from "node:child_process";

import { bootstrapDb } from "./bootstrap-db.mjs";
import { findFreePort, waitForServer } from "./cli-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// ── Parse --port flag ─────────────────────────────────
const argv = process.argv.slice(2);
const portIdx = argv.indexOf("--port");
const requestedPort = portIdx !== -1 ? Number(argv[portIdx + 1]) : null;

// ── Resolve data directory ─────────────────────────────
const dataDir = process.env.APP_DATA_DIR || path.join(os.homedir(), ".sidequests");
fs.mkdirSync(dataDir, { recursive: true });

// ── Copy default settings if missing ───────────────────
const settingsPath = path.join(dataDir, "settings.json");
if (!fs.existsSync(settingsPath)) {
  const defaults = {
    devRoot: path.join(os.homedir(), "dev"),
    theme: "dark",
    llmProvider: "claude-cli",
  };
  fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2));
  console.log("Created default settings.json");
}

// ── Bootstrap database ─────────────────────────────────
const dbPath = process.env.DATABASE_URL?.replace("file:", "") || path.join(dataDir, "dev.db");
const dbUrl = process.env.DATABASE_URL || `file:${dbPath}`;

console.log("Initializing database...");
await bootstrapDb(dbPath);
console.log("Database ready.");

// ── Find free port ──────────────────────────────────────
const apiPort = await findFreePort(requestedPort);
console.log(`API server will use port ${apiPort}`);

// ── Start Hono API server ──────────────────────────────
const serverEnv = {
  ...process.env,
  PORT: String(apiPort),
  HOSTNAME: "127.0.0.1",
  APP_DATA_DIR: dataDir,
  DATABASE_URL: dbUrl,
  NODE_ENV: "development",
};

const serverProcess = fork(
  path.join(projectRoot, "node_modules", ".bin", "tsx"),
  ["watch", path.join(projectRoot, "src", "server.ts")],
  { env: serverEnv, stdio: "pipe" }
);

serverProcess.stdout?.on("data", (chunk) => process.stdout.write(chunk));
serverProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));

// ── Wait for API readiness ─────────────────────────────
const apiUrl = `http://127.0.0.1:${apiPort}`;
try {
  await waitForServer(`${apiUrl}/api/health`);
  console.log(`API ready at ${apiUrl}`);
} catch (err) {
  console.error(`API server failed to start: ${err.message}`);
  serverProcess.kill();
  process.exit(1);
}

// ── Start Vite dev server ──────────────────────────────
// Pass the API port as an env var so vite.config.ts can read it
const viteEnv = {
  ...process.env,
  SIDEQUESTS_API_PORT: String(apiPort),
  SIDEQUESTS_API_URL: apiUrl,
};

const viteProcess = fork(
  path.join(projectRoot, "node_modules", ".bin", "vite"),
  ["--port", "5173", "--clearScreen", "false"],
  { env: viteEnv, stdio: "pipe", cwd: projectRoot }
);

viteProcess.stdout?.on("data", (chunk) => process.stdout.write(chunk));
viteProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));

// ── Graceful shutdown ──────────────────────────────────
function shutdown() {
  console.log("\nShutting down...");
  serverProcess.kill("SIGTERM");
  viteProcess.kill("SIGTERM");
  setTimeout(() => process.exit(0), 3000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

serverProcess.on("exit", (code) => {
  if (code !== null && code !== 0) {
    console.error(`API server exited with code ${code}`);
  }
  viteProcess.kill();
  process.exit(code ?? 1);
});

viteProcess.on("exit", (code) => {
  // If Vite dies, we should still keep the API alive for manual testing
  console.error(`Vite dev server exited with code ${code}`);
});