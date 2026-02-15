#!/usr/bin/env node

/**
 * Bootstrap script for Projects Dashboard.
 * Checks prerequisites, copies default config, and sets up the database.
 *
 * Usage: npm run setup
 */

import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

let warnings = 0;

/* ── Check Node version ──────────────────────────────── */

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  console.error(red(`Node >= 20.9.0 required (found ${process.versions.node})`));
  process.exit(1);
}
console.log(green(`✓ Node ${process.versions.node}`));

/* ── Check git ───────────────────────────────────────── */

try {
  const gitVer = execSync("git --version", { encoding: "utf-8" }).trim();
  console.log(green(`✓ ${gitVer}`));
} catch {
  console.warn(yellow("⚠ git not found — scanning will not work without it"));
  warnings++;
}

/* ── Copy settings.example.json → settings.json ─────── */

const settingsExample = join(root, "settings.example.json");
const settingsTarget = join(root, "settings.json");

if (existsSync(settingsTarget)) {
  console.log(green("✓ settings.json already exists (not overwriting)"));
} else {
  copyFileSync(settingsExample, settingsTarget);
  console.log(green("✓ Created settings.json from settings.example.json"));
}

/* ── Prisma generate + migrate ───────────────────────── */

console.log("\nSetting up database...");

try {
  execSync("npx prisma generate", { cwd: root, stdio: "inherit" });
  console.log(green("✓ Prisma client generated"));
} catch {
  console.error(red("✗ Failed to generate Prisma client"));
  process.exit(1);
}

try {
  execSync("npx prisma migrate dev", { cwd: root, stdio: "inherit" });
  console.log(green("✓ Database migrated"));
} catch {
  console.error(red("✗ Failed to run database migrations"));
  process.exit(1);
}

/* ── Summary ─────────────────────────────────────────── */

console.log("\n" + bold("Setup complete!"));
if (warnings > 0) {
  console.log(yellow(`${warnings} warning(s) — see above.`));
}
console.log(`
Next steps:
  1. ${bold("npm run dev")}           — start the dev server
  2. Open http://localhost:3000
  3. Click Settings → set your Dev Root
  4. Click Scan to discover projects
`);
