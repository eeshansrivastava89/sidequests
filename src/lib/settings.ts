import fs from "fs";
import path from "path";

export interface AppSettings {
  devRoot?: string;
  excludeDirs?: string;
  sanitizePaths?: boolean;
  featureLlm?: boolean;
  featureO1?: boolean;
  llmProvider?: string;
  llmConcurrency?: number;
  llmOverwriteMetadata?: boolean;
  llmAllowUnsafe?: boolean;
  llmDebug?: boolean;
  claudeCliModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
  mlxUrl?: string;
  mlxModel?: string;
}

const SETTINGS_PATH = path.join(process.cwd(), "settings.json");

let cache: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    cache = JSON.parse(raw) as AppSettings;
    return cache;
  } catch {
    return {};
  }
}

export function writeSettings(settings: AppSettings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  cache = settings;
}

export function clearSettingsCache(): void {
  cache = null;
}
