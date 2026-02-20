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
    const content = execSync(`git show HEAD:${file} 2>/dev/null || cat "${file}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
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

// ── Summary ─────────────────────────────────────────────────────────

console.log("\n=== Summary ===\n");
if (failures > 0) {
  console.error(`${RED}${failures} failure(s)${RESET}, ${warnings} warning(s)`);
  process.exit(1);
} else {
  console.log(`${GREEN}All checks passed${RESET} (${warnings} warning(s))`);
  process.exit(0);
}
