#!/usr/bin/env node

/**
 * CLI entry point for Sidequests.
 * Usage: npx @eeshans/sidequests [--port <n>] [--no-open] [--help] [--version]
 */

import { fork } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import { bootstrapDb } from "./bootstrap-db.mjs";
import { openBrowser } from "./open-browser.mjs";
import { resolveDataDir, findFreePort, waitForServer, parseArgs } from "./cli-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

// ── Color helpers ──────────────────────────────────────
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

// ── Parse args ─────────────────────────────────────────
const parsed = parseArgs(process.argv.slice(2));

if (parsed.help) {
  console.log(`
${bold("Sidequests")} v${pkg.version}

Usage: sidequests [options]

Options:
  --port <n>   Use a specific port (default: auto)
  --no-open    Don't open the browser automatically
  --help       Show this help message
  --version    Show version number
`);
  process.exit(0);
}

if (parsed.version) {
  console.log(pkg.version);
  process.exit(0);
}

const noOpen = parsed.noOpen;
const requestedPort = parsed.port;

// ── Check Node version ─────────────────────────────────
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  console.error(red(`Node >= 20.9.0 required (found ${process.versions.node})`));
  process.exit(1);
}

// ── Check git ──────────────────────────────────────────
try {
  execSync("git --version", { stdio: "ignore" });
} catch {
  console.warn(yellow("Warning: git not found — project scanning requires git"));
}

// ── Resolve data directory ─────────────────────────────
const dataDir = resolveDataDir();
fs.mkdirSync(dataDir, { recursive: true });

// ── Copy default settings if missing ───────────────────
const settingsPath = path.join(dataDir, "settings.json");
if (!fs.existsSync(settingsPath)) {
  const defaults = {
    devRoot: path.join(os.homedir(), "dev"),
    theme: "dark",
    llmProvider: "none",
  };
  fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2));
  console.log(green("Created default settings.json"));
}

// ── Bootstrap database ─────────────────────────────────
const dbPath = path.join(dataDir, "dev.db");
console.log("Initializing database...");
await bootstrapDb(dbPath);
console.log(green("Database ready."));

// ── Find free port ─────────────────────────────────────
const port = await findFreePort(requestedPort);

// ── Start Next.js standalone server ────────────────────
const serverPath = path.join(__dirname, "..", ".next", "standalone", "server.js");
if (!fs.existsSync(serverPath)) {
  console.error(red("Standalone server not found. Run `npm run build:npx` first."));
  process.exit(1);
}

const serverProcess = fork(serverPath, [], {
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    APP_DATA_DIR: dataDir,
    DATABASE_URL: `file:${dbPath}`,
    NODE_ENV: "production",
  },
  stdio: "pipe",
});

// Forward server stderr (for debugging)
serverProcess.stderr?.on("data", (chunk) => {
  process.stderr.write(chunk);
});

// ── Wait for server readiness ──────────────────────────
const serverUrl = `http://127.0.0.1:${port}`;

try {
  await waitForServer(`${serverUrl}/api/preflight`);
} catch (err) {
  console.error(red(err.message));
  serverProcess.kill();
  process.exit(1);
}

console.log(`\n${bold("Sidequests")} is running at ${green(serverUrl)}\n`);

if (!noOpen) {
  openBrowser(serverUrl);
}

// ── Graceful shutdown ──────────────────────────────────
function shutdown() {
  console.log("\nShutting down...");
  serverProcess.kill("SIGTERM");
  setTimeout(() => {
    serverProcess.kill("SIGKILL");
    process.exit(1);
  }, 5000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

serverProcess.on("exit", (code) => {
  if (code !== null && code !== 0) {
    console.error(red(`Server exited with code ${code}`));
  }
  process.exit(code ?? 0);
});
