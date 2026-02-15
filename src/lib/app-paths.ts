import path from "path";
import os from "os";
import fs from "fs";

export function defaultDesktopDataDir(): string {
  switch (process.platform) {
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "ProjectsDashboard");
    case "win32":
      return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "ProjectsDashboard");
    default: // linux and others
      return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "ProjectsDashboard");
  }
}

interface AppPaths {
  readonly dataDir: string;
  readonly dbPath: string;
  readonly dbUrl: string;
  readonly settingsPath: string;
  readonly pipelineDir: string;
  readonly isDesktopMode: boolean;
}

let cached: AppPaths | null = null;

function resolve(): AppPaths {
  if (cached) return cached;

  const appDataDir = process.env.APP_DATA_DIR;
  const isDesktopMode = !!appDataDir;
  const dataDir = appDataDir ?? process.cwd();

  if (isDesktopMode) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Database path
  const rawDbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const filePath = rawDbUrl.replace(/^file:/, "");
  const absoluteDb = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(dataDir, filePath);
  const dbPath = absoluteDb;
  const dbUrl = `file:${absoluteDb}`;

  // Settings
  const settingsPath = path.join(dataDir, "settings.json");

  // Pipeline — fallback precedence:
  //   1. PIPELINE_DIR env override (absolute)
  //   2. <dataDir>/pipeline (desktop: APP_DATA_DIR/pipeline, dev: cwd/pipeline)
  //   3. cwd/pipeline (desktop fallback when scripts haven't been copied to dataDir yet)
  const pipelineDir = resolvePipelineDir(isDesktopMode, dataDir);

  cached = { dataDir, dbPath, dbUrl, settingsPath, pipelineDir, isDesktopMode };
  return cached;
}

export const paths: AppPaths = {
  get dataDir() { return resolve().dataDir; },
  get dbPath() { return resolve().dbPath; },
  get dbUrl() { return resolve().dbUrl; },
  get settingsPath() { return resolve().settingsPath; },
  get pipelineDir() { return resolve().pipelineDir; },
  get isDesktopMode() { return resolve().isDesktopMode; },
};

function resolvePipelineDir(isDesktopMode: boolean, dataDir: string): string {
  if (process.env.PIPELINE_DIR) {
    return path.resolve(process.env.PIPELINE_DIR);
  }

  const dataDirPipeline = path.resolve(dataDir, "pipeline");

  if (!isDesktopMode) {
    return dataDirPipeline; // cwd/pipeline — same as before
  }

  // Desktop mode: prefer dataDir/pipeline if it exists (Phase 44 will copy scripts there),
  // otherwise fall back to cwd/pipeline (where scripts live during development)
  if (fs.existsSync(path.join(dataDirPipeline, "scan.py"))) {
    return dataDirPipeline;
  }

  const cwdPipeline = path.resolve(process.cwd(), "pipeline");
  if (fs.existsSync(path.join(cwdPipeline, "scan.py"))) {
    return cwdPipeline;
  }

  throw new Error(
    `Pipeline scripts not found. Searched:\n` +
    `  1. ${dataDirPipeline}\n` +
    `  2. ${cwdPipeline}\n` +
    `Set PIPELINE_DIR to the directory containing scan.py and derive.py.`
  );
}

export function resetPaths(): void {
  cached = null;
}
