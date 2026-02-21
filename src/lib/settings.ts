import fs from "fs";
import path from "path";
import { paths } from "./app-paths";

export interface AppSettings {
  devRoot?: string;
  excludeDirs?: string;
  sanitizePaths?: boolean;
  featureLlm?: boolean;
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
  hasCompletedOnboarding?: boolean;
}

/** Keys that must never be persisted to settings.json (stored in encrypted secrets). */
export const SECRET_KEYS: (keyof AppSettings)[] = ["openrouterApiKey"];

let cache: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(paths.settingsPath, "utf-8");
    const parsed = JSON.parse(raw) as AppSettings;
    // Warn if secrets are found in plaintext settings (migration should handle this)
    for (const key of SECRET_KEYS) {
      if (parsed[key]) {
        console.warn(`[settings] Secret key "${key}" found in settings.json — should be migrated to encrypted storage`);
      }
    }
    cache = parsed;
    return cache;
  } catch {
    return {};
  }
}

export function writeSettings(settings: AppSettings): void {
  // Strip secret keys — they belong in encrypted storage, not plaintext
  const cleaned = { ...settings };
  for (const key of SECRET_KEYS) {
    delete cleaned[key];
  }
  fs.mkdirSync(path.dirname(paths.settingsPath), { recursive: true });
  fs.writeFileSync(paths.settingsPath, JSON.stringify(cleaned, null, 2) + "\n");
  cache = cleaned;
}

export function clearSettingsCache(): void {
  cache = null;
}
