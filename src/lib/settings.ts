import fs from "fs";
import path from "path";
import { paths } from "./app-paths";

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

let cache: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(paths.settingsPath, "utf-8");
    cache = JSON.parse(raw) as AppSettings;
    return cache;
  } catch {
    return {};
  }
}

export function writeSettings(settings: AppSettings): void {
  fs.mkdirSync(path.dirname(paths.settingsPath), { recursive: true });
  fs.writeFileSync(paths.settingsPath, JSON.stringify(settings, null, 2) + "\n");
  cache = settings;
}

export function clearSettingsCache(): void {
  cache = null;
}
