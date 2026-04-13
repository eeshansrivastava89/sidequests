#!/usr/bin/env node
/**
 * Privacy & Artifact Gate
 *
 * Verifies:
 * 1. No forbidden files are tracked in git
 * 2. No hardcoded user paths in production source files
 *
 * Usage: node scripts/privacy-gate.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

let failures = 0;
let warnings = 0;

function fail(msg) {
  console.error(`${RED}FAIL${RESET} ${msg}`);
  failures++;
}

function pass(msg) {
  console.log(`${GREEN}PASS${RESET} ${msg}`);
}


// ── 1. Tracked files check ──────────────────────────────────────────

console.log("\n=== Tracked Files Gate ===\n");

const FORBIDDEN_TRACKED = [
  /^\.env\.local$/,
  /^\.env\.production$/,
  /^\.env\.development$/,
  /^settings\.json$/,
  /^secrets\.enc$/,
  /\.db$/,
  /\.db-journal$/,
  /\.db-wal$/,
  /\.db-shm$/,
  /\/\.env\.local$/,
  /\/settings\.json$/,
  /\/secrets\.enc$/,
];

// User-specific path patterns (should not appear in tracked source)
const USER_PATH_PATTERNS = [
  /\/Users\/(?!test\b)\w+/,    // macOS user paths (except /Users/test in fixtures)
  /\/home\/(?!test\b)\w+/,     // Linux user paths
  /C:\\Users\\\w+/,             // Windows user paths
];

const trackedFiles = execSync("git ls-files", { encoding: "utf-8" }).trim().split("\n");

// Check for forbidden tracked files
let trackedForbiddenFound = false;
for (const file of trackedFiles) {
  for (const pattern of FORBIDDEN_TRACKED) {
    if (pattern.test(file)) {
      fail(`Forbidden file tracked in git: ${file}`);
      trackedForbiddenFound = true;
    }
  }
}
if (!trackedForbiddenFound) {
  pass("No forbidden files (.env.local, settings.json, *.db, secrets.enc) tracked in git");
}

// Check tracked source files for hardcoded user paths (exclude test files and docs)
const sourceFiles = trackedFiles.filter(
  (f) => /\.(ts|tsx|mjs|js)$/.test(f) && !f.includes("__tests__") && !f.includes(".test.")
);

let userPathHits = [];
for (const file of sourceFiles) {
  try {
    const content = readFileSync(file, "utf-8");
    for (const pattern of USER_PATH_PATTERNS) {
      if (pattern.test(content)) {
        userPathHits.push(file);
        break;
      }
    }
  } catch {
    // File may be new/unstaged — skip
  }
}

if (userPathHits.length > 0) {
  for (const file of userPathHits) {
    fail(`Hardcoded user path in production source: ${file}`);
  }
} else {
  pass("No hardcoded user paths in production source files");
}

// ── 3. Tarball content gate ──────────────────────────────────────────

console.log("\n=== Tarball Content Gate ===\n");

const FORBIDDEN_IN_TARBALL = [
  /\.db$/,
  /\.db-journal$/,
  /\.db-wal$/,
  /\.db-shm$/,
  /settings\.json$/,
  /docs\/internal\//,
  /\.env\.local$/,
  /\.env\.production$/,
  /secrets\.enc$/,
];

try {
  const packList = execSync("npm pack --dry-run 2>&1", { encoding: "utf-8" });
  const lines = packList.split("\n").filter((l) => l.startsWith("npm notice") && !l.includes("Tarball") && !l.includes("name:") && !l.includes("version:") && !l.includes("filename:") && !l.includes("package size:") && !l.includes("unpacked size:") && !l.includes("shasum:") && !l.includes("integrity:") && !l.includes("total files:") && !l.includes("==="));

  let tarballForbiddenFound = false;
  for (const line of lines) {
    const match = line.match(/npm notice\s+[\d.]+[kMG]?B\s+(.+)/);
    if (!match) continue;
    const filePath = match[1].trim();
    for (const pattern of FORBIDDEN_IN_TARBALL) {
      if (pattern.test(filePath)) {
        fail(`Forbidden file in npm tarball: ${filePath}`);
        tarballForbiddenFound = true;
      }
    }
  }

  // Also check for user paths in tarball file listing
  for (const line of lines) {
    const match = line.match(/npm notice\s+[\d.]+[kMG]?B\s+(.+)/);
    if (!match) continue;
    const filePath = match[1].trim();
    for (const pattern of USER_PATH_PATTERNS) {
      if (pattern.test(filePath)) {
        fail(`User path in tarball file path: ${filePath}`);
        tarballForbiddenFound = true;
      }
    }
  }

  if (!tarballForbiddenFound) {
    pass("No forbidden files (*.db, settings.json, docs/internal/, .env) in npm tarball");
  }
} catch (e) {
  console.warn("⚠ Could not run tarball content check:", e.message);
  warnings++;
}

// ── 4. Build-machine path in server.js ───────────────────────────────

console.log("\n=== Build Path Gate ===\n");

import { existsSync as fsExists, readFileSync as fsRead } from "node:fs";
import os from "node:os";

const serverJsPath = ".next/standalone/server.js";
if (fsExists(serverJsPath)) {
  const serverContent = fsRead(serverJsPath, "utf-8");
  const homedir = os.homedir();
  if (serverContent.includes(homedir)) {
    fail(`Build-machine home path (${homedir}) found in ${serverJsPath}`);
  } else {
    pass("No build-machine paths in server.js");
  }
} else {
  pass("server.js not present (no standalone build)");
}

// ── 5. Tarball content secret scan ──────────────────────────────────

console.log("\n=== Tarball Content Secret Scan ===\n");

const SECRET_PATTERNS = [
  { name: "OpenRouter API key", pattern: /sk-or-v1-[a-zA-Z0-9]+/ },
  { name: "Anthropic API key", pattern: /sk-ant-api[0-9]+-[a-zA-Z0-9_-]+/ },
  { name: "OpenAI API key", pattern: /sk-proj-[a-zA-Z0-9_-]{20,}/ },
];

const walkFiles = (dir) => {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(full));
    else results.push(full);
  }
  return results;
};

let _tarball = null;
let _tmpDir = null;
try {
  const packJson = JSON.parse(execSync("npm pack --json 2>/dev/null", { encoding: "utf-8" }));
  _tarball = packJson[0].filename;
  _tmpDir = mkdtempSync(join(os.tmpdir(), "sq-scan-"));
  execSync(`tar -C "${_tmpDir}" -xzf "${_tarball}"`, { encoding: "utf-8" });

  const allFiles = walkFiles(_tmpDir);
  let secretsFound = false;

  for (const file of allFiles) {
    let content;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue; // binary file — skip
    }
    for (const { name: secretName, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        const rel = file.slice(_tmpDir.length + 1);
        fail(`Secret found in tarball (${secretName}) in: ${rel}`);
        secretsFound = true;
      }
    }
  }

  if (!secretsFound) {
    pass("No secrets found in tarball contents");
  }
} catch (e) {
  console.warn("⚠ Could not run tarball content secret scan:", e.message);
  warnings++;
} finally {
  if (_tarball) rmSync(_tarball, { force: true });
  if (_tmpDir) rmSync(_tmpDir, { recursive: true, force: true });
}

// ── Summary ─────────────────────────────────────────────────────────

console.log("\n=== Summary ===\n");
if (failures > 0) {
  console.error(`${RED}${failures} failure(s)${RESET}, ${warnings} warning(s)`);
  process.exit(1);
} else {
  console.log(`${GREEN}All checks passed${RESET} (${warnings} warning(s))`);
  process.exit(0);
}
