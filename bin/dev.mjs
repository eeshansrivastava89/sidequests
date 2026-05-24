#!/usr/bin/env node

/**
 * Dev entry point for Sidequests.
 *
 * Handles: find free port → bootstrap DB → start API server → wait for
 * readiness → start Vite. All processes are guaranteed to be cleaned up
 * on exit (Ctrl+C, crash, or natural shutdown).
 *
 * Usage: npm run dev [-- --port <n>]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { bootstrapDb } from "./bootstrap-db.mjs";
import { findFreePort, waitForServer } from "./cli-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

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
console.log(green("Database ready."));

// ── Find free port ──────────────────────────────────────
const apiPort = await findFreePort(requestedPort);

// ── Resolve direct binary paths ────────────────────────
// We spawn tsx and vite directly instead of through npm/npx to avoid
// orphan wrapper processes that survive SIGTERM.
const isWin = process.platform === "win32";
const binExt = isWin ? ".cmd" : "";
const tsxBin = path.join(projectRoot, "node_modules", ".bin", `tsx${binExt}`);
const viteBin = path.join(projectRoot, "node_modules", ".bin", `vite${binExt}`);

// ── Child process tracking ──────────────────────────────
/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

function spawnChild(command, args, opts) {
  const child = spawn(command, args, {
    ...opts,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  children.push(child);

  child.on("exit", (code, signal) => {
    const idx = children.indexOf(child);
    if (idx !== -1) children.splice(idx, 1);

    if (!shuttingDown) {
      const label = child._label || "child process";
      if (code !== null) {
        console.error(red(`${label} exited with code ${code}. Shutting down.`));
      } else {
        console.error(red(`${label} killed by signal ${signal}. Shutting down.`));
      }
      // If one child dies unexpectedly, tear down the other
      killAll();
      process.exit(code ?? 1);
    }
  });

  return child;
}

function killAll() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    // SIGTERM first, then SIGKILL after a grace period.
    // Since we spawn directly (no npm/npx wrapper), SIGTERM propagates
    // to tsx watch and vite correctly.
    child.kill("SIGTERM");
  }

  // Force-kill after 3 seconds if anything lingers
  setTimeout(() => {
    for (const child of children) {
      child.kill("SIGKILL");
    }
  }, 3000);
}

// ── Start Hono API server ──────────────────────────────
const serverEnv = {
  ...process.env,
  PORT: String(apiPort),
  HOSTNAME: "127.0.0.1",
  APP_DATA_DIR: dataDir,
  DATABASE_URL: dbUrl,
  NODE_ENV: "development",
};

const apiProcess = spawnChild(tsxBin, ["watch", path.join(projectRoot, "src", "server.ts")], {
  env: serverEnv,
  cwd: projectRoot,
});
apiProcess._label = "API server";

// ── Wait for API readiness ─────────────────────────────
const apiUrl = `http://127.0.0.1:${apiPort}`;

try {
  await waitForServer(`${apiUrl}/api/health`);
  console.log(`${green("API ready")} at ${bold(apiUrl)}`);
} catch (err) {
  console.error(red(`API server failed to start: ${err.message}`));
  killAll();
  process.exit(1);
}

// ── Start Vite dev server ──────────────────────────────
const vitePort = parseInt(process.env.VITE_PORT || "5173", 10);
const viteEnv = {
  ...process.env,
  SIDEQUESTS_API_PORT: String(apiPort),
  SIDEQUESTS_API_URL: apiUrl,
};

const viteProcess = spawnChild(viteBin, ["--port", String(vitePort)], {
  env: viteEnv,
  cwd: projectRoot,
});
viteProcess._label = "Vite dev server";

// ── Graceful shutdown on Ctrl+C ────────────────────────
function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down...`);
  killAll();
  // Give processes 3s to clean up, then force exit
  setTimeout(() => process.exit(0), 3500);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── Print startup message ──────────────────────────────
console.log(`\n${bold("Sidequests")} dev server running:\n`);
console.log(`  API:  ${green(apiUrl)}`);
console.log(`  SPA:  ${green(`http://localhost:${vitePort}`)}\n`);
console.log("  Press Ctrl+C to stop.\n");