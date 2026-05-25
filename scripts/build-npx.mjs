#!/usr/bin/env node

/**
 * Build script for NPX distribution.
 * Builds the Vite SPA + bundles the Hono server for production.
 */

import { execSync } from "node:child_process";
import { cpSync, rmSync, chmodSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

// 1. Vite build (SPA)
run("npx vite build");

// 2. Bundle Express server with esbuild (using JS API for banner with curly braces)
import * as esbuild from "esbuild";
await esbuild.build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/server.js",
  external: ["@prisma/adapter-libsql", "libsql"],
  banner: {
    js: 'import{createRequire}from"module";const require=createRequire(import.meta.url);',
  },
});

// 3. Copy Vite SPA assets to dist/
// Vite puts assets in dist/assets already, but we need index.html at dist/index.html
// (Vite build already puts it there)

// 4. Copy node_modules that the server needs
// The bundled server.js still needs native modules at runtime
const distDir = "dist";
const nodeModulesDir = join(distDir, "node_modules");
if (!existsSync(nodeModulesDir)) {
  mkdirSync(nodeModulesDir, { recursive: true });
}

const copyMod = (name) => {
  const src = `node_modules/${name}`;
  if (!existsSync(src)) {
    console.warn(`⚠ Optional module ${name} not found, skipping`);
    return;
  }
  cpSync(src, join(nodeModulesDir, name), { recursive: true });
};

// Prisma + libsql native bindings
copyMod("@prisma/client");
copyMod("@prisma/adapter-libsql");
copyMod("@libsql/core");
copyMod("@libsql/hrana-client");
copyMod("libsql");

// Express sub-dependencies (bundled by esbuild, but their native/binary parts are external)
// No need to copy Express itself — it's bundled in server.js;

// Platform-aware native binding for libsql
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

// 5. Copy prompt templates
cpSync("src/config/prompts", join(distDir, "config", "prompts"), { recursive: true });

// 6. Copy Prisma generated client
cpSync("src/generated/prisma", join(nodeModulesDir, "src", "generated", "prisma"), { recursive: true });

// 6. Clean up dev-only files from dist
const stripFiles = [
  join(distDir, ".env"),
  join(distDir, ".env.local"),
  join(distDir, "settings.json"),
];

for (const f of stripFiles) {
  rmSync(f, { force: true });
}

// Remove any stray .db files
for (const entry of readdirSync(distDir)) {
  if (entry.endsWith(".db") || entry.endsWith(".db-journal") || entry.endsWith(".db-wal") || entry.endsWith(".db-shm")) {
    rmSync(join(distDir, entry), { force: true });
  }
}

// Remove internal docs
rmSync(join(distDir, "docs"), { recursive: true, force: true });

// 7. Create package.json for the dist directory (needed for ESM resolution)
const distPkg = {
  name: "sidequests-server",
  type: "module",
};
writeFileSync(join(distDir, "package.json"), JSON.stringify(distPkg, null, 2));

// 8. Make CLI executable
chmodSync("bin/cli.mjs", 0o755);

console.log("✓ NPX bundle built successfully");