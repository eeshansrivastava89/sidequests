/**
 * TypeScript-native scan — deterministic scanner for ~/dev projects.
 *
 * Port of pipeline/scan.py. Collects raw git info, language indicators,
 * file flags, TODO/FIXME counts. Returns structured data (no subprocess).
 */

import { createHash } from "crypto";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Constants (mirroring scan.py)
// ---------------------------------------------------------------------------

const LANGUAGE_INDICATORS: Record<string, string> = {
  "package.json": "JavaScript/TypeScript",
  "pyproject.toml": "Python",
  "setup.py": "Python",
  "requirements.txt": "Python",
  "Cargo.toml": "Rust",
  "go.mod": "Go",
  "Gemfile": "Ruby",
  "build.gradle": "Java/Kotlin",
  "pom.xml": "Java",
  "mix.exs": "Elixir",
  "Package.swift": "Swift",
  "composer.json": "PHP",
  "index.html": "HTML/CSS",
};

const SOURCE_EXTENSIONS = new Set([
  ".py", ".ts", ".tsx", ".js", ".jsx", ".rs", ".go", ".rb", ".java", ".kt",
  ".ex", ".exs", ".swift", ".php", ".c", ".cpp", ".h",
]);

const SKIP_WALK_DIRS = new Set([
  "node_modules", ".venv", ".git", "__pycache__", "dist", "build",
  ".next", "target", ".tox", "venv", "env",
]);

const SERVICE_DEPS: Record<string, string> = {
  "@supabase/supabase-js": "supabase",
  "posthog-js": "posthog",
  "posthog-node": "posthog",
  stripe: "stripe",
  firebase: "firebase",
  "firebase-admin": "firebase",
  "@aws-sdk": "aws",
  "@prisma/client": "prisma",
  mongoose: "mongodb",
  "@sentry": "sentry",
};

const ENV_KEY_PREFIXES: [string, string][] = [
  ["SUPABASE_", "supabase"],
  ["POSTHOG_", "posthog"],
  ["NEXT_PUBLIC_POSTHOG", "posthog"],
  ["STRIPE_", "stripe"],
  ["FIREBASE_", "firebase"],
  ["AWS_", "aws"],
  ["DATABASE_URL", "database"],
  ["SENTRY_", "sentry"],
  ["OPENAI_", "openai"],
  ["ANTHROPIC_", "anthropic"],
];

const LOCKFILE_MAP: [string, string][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["Cargo.lock", "cargo"],
  ["uv.lock", "uv"],
  ["poetry.lock", "poetry"],
  ["Pipfile.lock", "pipenv"],
];

const LINTER_FILES = [
  ".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.yml",
  "eslint.config.js", "eslint.config.mjs", "eslint.config.ts",
  ".prettierrc", ".prettierrc.js", ".prettierrc.json",
  "biome.json", "biome.jsonc",
  ".flake8", ".pylintrc", "pyproject.toml",
  ".rubocop.yml", "rustfmt.toml",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function pathHash(absolutePath: string): string {
  return createHash("sha256").update(absolutePath).digest("hex").slice(0, 16);
}

function runGit(cwd: string, ...args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      timeout: 5_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim() || null;
  } catch {
    return null;
  }
}

function existsAt(dir: string, file: string): boolean {
  return fs.existsSync(path.join(dir, file));
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

function getGitInfo(projectPath: string): Record<string, unknown> {
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    return {
      isRepo: false,
      lastCommitDate: null,
      lastCommitMessage: null,
      branch: null,
      remoteUrl: null,
      commitCount: 0,
      daysInactive: null,
      isDirty: false,
      untrackedCount: 0,
      modifiedCount: 0,
      stagedCount: 0,
      ahead: 0,
      behind: 0,
      recentCommits: [],
      branchCount: 0,
      stashCount: 0,
    };
  }

  const lastDate = runGit(projectPath, "log", "-1", "--format=%aI");
  const lastMsg = runGit(projectPath, "log", "-1", "--format=%s");
  const branch = runGit(projectPath, "rev-parse", "--abbrev-ref", "HEAD");
  const remote = runGit(projectPath, "remote", "get-url", "origin");
  const countStr = runGit(projectPath, "rev-list", "--count", "HEAD");
  const commitCount = countStr ? parseInt(countStr, 10) : 0;

  let daysInactive: number | null = null;
  if (lastDate) {
    try {
      const lastDt = new Date(lastDate);
      daysInactive = Math.floor((Date.now() - lastDt.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      // ignore
    }
  }

  // Working tree status
  const statusOutput = runGit(projectPath, "status", "--porcelain");
  let isDirty = false;
  let untracked = 0;
  let modified = 0;
  let staged = 0;
  if (statusOutput) {
    isDirty = true;
    for (const line of statusOutput.split("\n")) {
      if (line.length < 2) continue;
      const x = line[0];
      const y = line[1];
      if (x === "?" && y === "?") untracked++;
      if (y === "M" || x === "M") modified++;
      if ("AMRD".includes(x) && y !== "?") staged++;
    }
  }

  // Ahead/behind
  let aheadCount = 0;
  let behindCount = 0;
  if (branch) {
    const abOutput = runGit(projectPath, "rev-list", "--count", "--left-right", "@{upstream}...HEAD");
    if (abOutput) {
      const parts = abOutput.split(/\s+/);
      if (parts.length === 2) {
        behindCount = parseInt(parts[0], 10) || 0;
        aheadCount = parseInt(parts[1], 10) || 0;
      }
    }
  }

  // Recent commits
  const recentCommits: Array<{ hash: string; date: string; message: string }> = [];
  const logOutput = runGit(projectPath, "log", "-10", "--format=%H|%aI|%s");
  if (logOutput) {
    for (const line of logOutput.split("\n")) {
      const parts = line.split("|", 3);
      if (parts.length === 3) {
        recentCommits.push({ hash: parts[0], date: parts[1], message: parts[2] });
      }
    }
  }

  // Branch count
  const branchOutput = runGit(projectPath, "branch", "--list");
  const branchCount = branchOutput ? branchOutput.split("\n").length : 0;

  // Stash count
  const stashOutput = runGit(projectPath, "stash", "list");
  const stashCount = stashOutput ? stashOutput.split("\n").length : 0;

  return {
    isRepo: true,
    lastCommitDate: lastDate,
    lastCommitMessage: lastMsg,
    branch,
    remoteUrl: remote,
    commitCount,
    daysInactive,
    isDirty,
    untrackedCount: untracked,
    modifiedCount: modified,
    stagedCount: staged,
    ahead: aheadCount,
    behind: behindCount,
    recentCommits,
    branchCount,
    stashCount,
  };
}

function detectLanguages(projectPath: string): { primary: string | null; detected: string[] } {
  const detected: string[] = [];
  let primary: string | null = null;

  for (const [indicator, lang] of Object.entries(LANGUAGE_INDICATORS)) {
    if (existsAt(projectPath, indicator)) {
      if (!detected.includes(lang)) detected.push(lang);
      if (primary === null) primary = lang;
    }
  }

  if (existsAt(projectPath, "tsconfig.json")) {
    if (detected.includes("JavaScript/TypeScript")) {
      primary = "TypeScript";
    } else if (!detected.includes("TypeScript")) {
      detected.push("TypeScript");
      if (primary === null) primary = "TypeScript";
    }
  }

  return { primary, detected };
}

function checkFiles(projectPath: string): Record<string, boolean> {
  const p = projectPath;
  const testDirs = ["tests", "test", "__tests__", "spec", "src/tests", "src/__tests__"];
  const hasTests = testDirs.some((d) => fs.existsSync(path.join(p, d))) ||
    (() => {
      try {
        return fs.readdirSync(p).some((f) => f.includes("test"));
      } catch {
        return false;
      }
    })();

  const hasLinter = LINTER_FILES.some((f) => existsAt(p, f));
  const hasLockfile = LOCKFILE_MAP.some(([f]) => existsAt(p, f));

  return {
    readme: existsAt(p, "README.md") || existsAt(p, "readme.md"),
    tests: hasTests,
    env: existsAt(p, ".env"),
    envExample: existsAt(p, ".env.example"),
    dockerfile: existsAt(p, "Dockerfile"),
    dockerCompose: existsAt(p, "docker-compose.yml") || existsAt(p, "docker-compose.yaml") || existsAt(p, "compose.yml"),
    linterConfig: hasLinter,
    license: detectLicense(p),
    lockfile: hasLockfile,
  };
}

function checkCicd(projectPath: string): Record<string, boolean> {
  return {
    githubActions: fs.existsSync(path.join(projectPath, ".github", "workflows")),
    circleci: fs.existsSync(path.join(projectPath, ".circleci")),
    travis: existsAt(projectPath, ".travis.yml"),
    gitlabCi: existsAt(projectPath, ".gitlab-ci.yml"),
  };
}

function checkDeployment(projectPath: string): Record<string, boolean> {
  return {
    fly: existsAt(projectPath, "fly.toml"),
    vercel: existsAt(projectPath, "vercel.json"),
    netlify: existsAt(projectPath, "netlify.toml"),
  };
}

function countTodos(projectPath: string): [number, number, number] {
  let todoCount = 0;
  let fixmeCount = 0;
  let locCount = 0;

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_WALK_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!SOURCE_EXTENSIONS.has(ext)) continue;
        try {
          const content = fs.readFileSync(path.join(dir, entry.name), "utf-8");
          // Match Python iterator semantics: split on \n but don't count
          // a trailing empty element from a final newline
          const lines = content.split("\n");
          const lineCount = lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
          for (let li = 0; li < lineCount; li++) {
            locCount++;
            if (lines[li].includes("TODO")) todoCount++;
            if (lines[li].includes("FIXME")) fixmeCount++;
          }
        } catch {
          // permission error, skip
        }
      }
    }
  }

  walk(projectPath);
  return [todoCount, fixmeCount, locCount];
}

function getDescription(projectPath: string): string | null {
  const pkg = readJsonSafe(path.join(projectPath, "package.json"));
  if (pkg) {
    const desc = pkg.description;
    if (typeof desc === "string" && desc) return desc;
  }

  const pyprojectPath = path.join(projectPath, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    try {
      const text = fs.readFileSync(pyprojectPath, "utf-8");
      for (const line of text.split("\n")) {
        if (line.trim().startsWith("description")) {
          const parts = line.split("=", 2);
          if (parts.length === 2) {
            return parts[1].trim().replace(/^["']|["']$/g, "");
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function detectScripts(projectPath: string): string[] {
  const pkg = readJsonSafe(path.join(projectPath, "package.json"));
  if (pkg) {
    const scripts = pkg.scripts;
    if (scripts && typeof scripts === "object") {
      return Object.keys(scripts);
    }
  }
  return [];
}

function detectServices(projectPath: string): string[] {
  const services = new Set<string>();

  // Check package.json
  const pkg = readJsonSafe(path.join(projectPath, "package.json"));
  if (pkg) {
    const allDeps: Record<string, unknown> = {
      ...((pkg.dependencies as Record<string, unknown>) ?? {}),
      ...((pkg.devDependencies as Record<string, unknown>) ?? {}),
    };
    for (const depName of Object.keys(allDeps)) {
      for (const [pattern, service] of Object.entries(SERVICE_DEPS)) {
        if (depName === pattern || depName.startsWith(pattern + "/")) {
          services.add(service);
        }
      }
    }
  }

  // Check .env key prefixes
  for (const envFile of [".env", ".env.local", ".env.development"]) {
    const envPath = path.join(projectPath, envFile);
    if (!fs.existsSync(envPath)) continue;
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const key = trimmed.split("=", 1)[0].trim();
        for (const [prefix, service] of ENV_KEY_PREFIXES) {
          if (key.startsWith(prefix)) services.add(service);
        }
      }
    } catch {
      // ignore
    }
  }

  return [...services].sort();
}

function detectPackageManager(projectPath: string): string | null {
  for (const [filename, manager] of LOCKFILE_MAP) {
    if (existsAt(projectPath, filename)) return manager;
  }
  return null;
}

function detectLicense(projectPath: string): boolean {
  return existsAt(projectPath, "LICENSE") || existsAt(projectPath, "LICENSE.md");
}

function hasLanguageIndicators(projectPath: string): boolean {
  return Object.keys(LANGUAGE_INDICATORS).some((f) => existsAt(projectPath, f));
}

// ---------------------------------------------------------------------------
// Lightweight directory enumeration (no deep scan)
// ---------------------------------------------------------------------------

export interface ProjectDir {
  name: string;
  absPath: string;
  pathHash: string;
}

export function listProjectDirs(devRoot: string, excludeDirs: string[], includeNonGitDirs = true): ProjectDir[] {
  if (!fs.existsSync(devRoot) || !fs.statSync(devRoot).isDirectory()) {
    throw new Error(`Scan root not found: ${devRoot}`);
  }

  const excludeSet = new Set(excludeDirs.filter(Boolean));
  const dirs: ProjectDir[] = [];
  const entries = fs.readdirSync(devRoot, { withFileTypes: true });

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    if (excludeSet.has(entry.name)) continue;

    const absPath = path.join(devRoot, entry.name);
    if (!includeNonGitDirs && !fs.existsSync(path.join(absPath, ".git")) && !hasLanguageIndicators(absPath)) {
      continue;
    }

    dirs.push({ name: entry.name, absPath, pathHash: pathHash(absPath) });
  }

  return dirs;
}

// ---------------------------------------------------------------------------
// Main scan function
// ---------------------------------------------------------------------------

export interface ScanOutput {
  scannedAt: string;
  projectCount: number;
  projects: Array<Record<string, unknown>>;
}

export function scanProject(absPath: string): Record<string, unknown> {
  const name = path.basename(absPath);
  const gitInfo = getGitInfo(absPath);
  const languages = detectLanguages(absPath);
  const files = checkFiles(absPath);
  const cicd = checkCicd(absPath);
  const deployment = checkDeployment(absPath);
  const [todoCount, fixmeCount, locEstimate] = countTodos(absPath);
  const description = getDescription(absPath);
  const framework = null; // Phase 61W: framework detection moved to LLM enrichment

  let liveUrl: string | null = null;
  const pkg = readJsonSafe(path.join(absPath, "package.json"));
  if (pkg) {
    const homepage = pkg.homepage;
    if (typeof homepage === "string" && homepage.trim()) {
      liveUrl = homepage.trim();
    }
  }

  const scripts = detectScripts(absPath);
  const services = detectServices(absPath);
  const packageManager = detectPackageManager(absPath);
  const license = detectLicense(absPath);

  return {
    name,
    path: absPath,
    pathHash: pathHash(absPath),
    ...gitInfo,
    languages,
    files,
    cicd,
    deployment,
    todoCount,
    fixmeCount,
    description,
    framework,
    liveUrl,
    scripts,
    services,
    locEstimate,
    packageManager,
    license,
  };
}

export function scanAll(devRoot: string, excludeDirs: string[], includeNonGitDirs = true): ScanOutput {
  if (!fs.existsSync(devRoot) || !fs.statSync(devRoot).isDirectory()) {
    throw new Error(`Scan root not found: ${devRoot}`);
  }

  const excludeSet = new Set(excludeDirs.filter(Boolean));
  const projects: Array<Record<string, unknown>> = [];
  const entries = fs.readdirSync(devRoot, { withFileTypes: true });

  // Sort for deterministic order
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    if (excludeSet.has(entry.name)) continue;

    const absPath = path.join(devRoot, entry.name);
    if (!includeNonGitDirs && !fs.existsSync(path.join(absPath, ".git")) && !hasLanguageIndicators(absPath)) {
      continue;
    }

    projects.push(scanProject(absPath));
  }

  return {
    scannedAt: new Date().toISOString(),
    projectCount: projects.length,
    projects,
  };
}
