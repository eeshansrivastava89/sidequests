import path from "path";
import fs from "fs";

interface AppPaths {
  readonly dataDir: string;
  readonly dbPath: string;
  readonly dbUrl: string;
  readonly settingsPath: string;
  readonly pipelineDir: string;
}

let cached: AppPaths | null = null;

function resolve(): AppPaths {
  if (cached) return cached;

  const appDataDir = process.env.APP_DATA_DIR;
  const dataDir = appDataDir ?? process.cwd();

  if (appDataDir) {
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

  // Pipeline — PIPELINE_DIR env override, otherwise dataDir/pipeline
  const pipelineDir = process.env.PIPELINE_DIR
    ? path.resolve(process.env.PIPELINE_DIR)
    : path.resolve(dataDir, "pipeline");

  cached = { dataDir, dbPath, dbUrl, settingsPath, pipelineDir };
  return cached;
}

export const paths: AppPaths = {
  get dataDir() { return resolve().dataDir; },
  get dbPath() { return resolve().dbPath; },
  get dbUrl() { return resolve().dbUrl; },
  get settingsPath() { return resolve().settingsPath; },
  get pipelineDir() { return resolve().pipelineDir; },
};

export function resetPaths(): void {
  cached = null;
}
