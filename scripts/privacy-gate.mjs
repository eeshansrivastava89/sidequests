#!/usr/bin/env node
/**
 * Privacy & Artifact Gate
 *
 * Verifies:
 * 1. No forbidden files are tracked in git
 * 2. Packaged Electron artifact contains only runtime-essential files
 *
 * Usage: node scripts/privacy-gate.mjs [--check-artifact]
 *   --check-artifact  Also inspect the unpacked Electron app (requires prior electron:build --dir)
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

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

// ── 2. Packaged artifact check ──────────────────────────────────────

const checkArtifact = process.argv.includes("--check-artifact");

if (checkArtifact) {
  console.log("\n=== Packaged Artifact Gate ===\n");

  // Find the unpacked app directory
  const distDir = "dist";
  const macDirs = ["mac-arm64", "mac", "mac-x64"];
  let appDir = null;

  for (const d of macDirs) {
    const candidate = join(distDir, d);
    if (existsSync(candidate)) {
      appDir = candidate;
      break;
    }
  }

  if (!appDir) {
    fail("No unpacked Electron app found in dist/. Run: npm run electron:build -- --dir");
  } else {
    // Find the app.asar or app directory inside the .app bundle
    const appBundle = readdirSync(appDir).find((f) => f.endsWith(".app"));
    if (!appBundle) {
      fail(`No .app bundle found in ${appDir}`);
    } else {
      const resourcesDir = join(appDir, appBundle, "Contents", "Resources");

      // Check for asar — if it exists, list contents
      const asarPath = join(resourcesDir, "app.asar");
      const unpackedDir = join(resourcesDir, "app");

      const FORBIDDEN_IN_ARTIFACT = [
        /\.env\.local$/,
        /\.env\.production$/,
        /\.env\.development$/,
        /settings\.json$/,
        /secrets\.enc$/,
        /\.db$/,
        /\.db-journal$/,
        /\.db-wal$/,
        /node_modules\/\.cache/,
        /\.git\//,
        /pipeline\/.*\.py$/,
      ];

      let artifactFiles = [];

      if (existsSync(asarPath)) {
        // List asar contents
        try {
          const listing = execSync(`npx asar list "${asarPath}"`, { encoding: "utf-8" });
          artifactFiles = listing.trim().split("\n");
        } catch {
          fail("Could not list app.asar contents (npx asar not available). Checking unpacked fallback.");
        }
      }

      if (artifactFiles.length === 0 && existsSync(unpackedDir)) {
        // Walk unpacked directory
        function walk(dir) {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(full);
            } else {
              artifactFiles.push(relative(unpackedDir, full));
            }
          }
        }
        walk(unpackedDir);
      }

      if (artifactFiles.length === 0) {
        // electron-builder with --dir doesn't always use asar
        // Check inside Resources for app directory
        const appResourceDir = join(resourcesDir, "app");
        if (!existsSync(appResourceDir)) {
          fail("Could not locate artifact contents for inspection when --check-artifact was requested.");
        }
      }

      if (artifactFiles.length > 0) {
        let forbiddenFound = false;
        for (const file of artifactFiles) {
          for (const pattern of FORBIDDEN_IN_ARTIFACT) {
            if (pattern.test(file)) {
              fail(`Forbidden file in packaged artifact: ${file}`);
              forbiddenFound = true;
            }
          }
        }
        if (!forbiddenFound) {
          pass(`Packaged artifact clean (${artifactFiles.length} files checked, no forbidden entries)`);
        }

        // Report artifact stats
        const nodeModulesFiles = artifactFiles.filter((f) => f.includes("node_modules"));
        const appFiles = artifactFiles.filter((f) => !f.includes("node_modules"));
        console.log(`  App files: ${appFiles.length}, node_modules files: ${nodeModulesFiles.length}`);
      }
    }
  }
} else {
  console.log("\n=== Packaged Artifact Gate (skipped) ===");
  console.log("  Run with --check-artifact to inspect packaged app contents.");
  console.log("  Requires prior: npm run electron:build -- --dir\n");
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
