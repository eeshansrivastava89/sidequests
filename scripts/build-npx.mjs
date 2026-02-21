#!/usr/bin/env node

/**
 * Build script for NPX distribution.
 * Platform-aware: copies the correct @libsql native binding for the current OS/arch.
 */

import { execSync } from "node:child_process";
import { cpSync, rmSync, chmodSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

// 1. Next.js build
run("next build");

// 2. Copy static assets
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
rmSync(".next/standalone/public", { recursive: true, force: true });
cpSync("public", ".next/standalone/public", { recursive: true });

// 3. Copy node_modules that Next.js standalone misses
run("cp -rL .next/node_modules/* .next/standalone/node_modules/");

const copyMod = (name) =>
  cpSync(`node_modules/${name}`, `.next/standalone/node_modules/${name}`, {
    recursive: true,
  });

copyMod("@libsql/core");
copyMod("@libsql/hrana-client");
copyMod("libsql");
copyMod("cross-fetch");

// 4. Platform-aware native binding
const platformMap = {
  "darwin-arm64": "@libsql/darwin-arm64",
  "darwin-x64": "@libsql/darwin-x64",
  "linux-x64": "@libsql/linux-x64-gnu",
  "linux-arm64": "@libsql/linux-arm64-gnu",
  "win32-x64": "@libsql/win32-x64-msvc",
};

const key = `${process.platform}-${process.arch}`;
const nativePackage = platformMap[key];

if (nativePackage && existsSync(`node_modules/${nativePackage}`)) {
  copyMod(nativePackage);
} else {
  console.warn(`⚠ No native @libsql binding found for ${key}, skipping`);
}

// 5. Strip private/dev files from standalone
const stripFiles = [
  ".next/standalone/.env",
  ".next/standalone/.env.local",
  ".next/standalone/settings.json",
];

for (const f of stripFiles) {
  rmSync(f, { force: true });
}

// Remove ALL .db files (dev.db, test.db, any stray databases)
const standaloneRoot = ".next/standalone";
for (const entry of readdirSync(standaloneRoot)) {
  if (entry.endsWith(".db") || entry.endsWith(".db-journal") || entry.endsWith(".db-wal") || entry.endsWith(".db-shm")) {
    rmSync(join(standaloneRoot, entry), { force: true });
  }
}
const prismaDir = join(standaloneRoot, "prisma");
if (existsSync(prismaDir)) {
  for (const entry of readdirSync(prismaDir)) {
    if (entry.endsWith(".db") || entry.endsWith(".db-journal") || entry.endsWith(".db-wal") || entry.endsWith(".db-shm")) {
      rmSync(join(prismaDir, entry), { force: true });
    }
  }
}

// Remove internal docs (may be copied by Next.js standalone)
rmSync(".next/standalone/docs/internal", { recursive: true, force: true });

chmodSync("bin/cli.mjs", 0o755);

console.log("✓ NPX bundle built successfully");
