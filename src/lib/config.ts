import path from "path";
import os from "os";
import { getSettings } from "./settings";

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

/** Resolve: settings.json > env > default */
function settingBool(settingsKey: keyof ReturnType<typeof getSettings>, envKey: string, fallback: boolean): boolean {
  const s = getSettings()[settingsKey];
  if (typeof s === "boolean") return s;
  return envBool(envKey, fallback);
}

function settingStr(settingsKey: keyof ReturnType<typeof getSettings>, envKey: string, fallback: string): string {
  const s = getSettings()[settingsKey];
  if (typeof s === "string" && s) return s;
  return process.env[envKey] || fallback;
}

export const config = {
  get devRoot(): string {
    return expandHome(settingStr("devRoot", "DEV_ROOT", "~/dev"));
  },
  get excludeDirs(): string[] {
    const raw = settingStr("excludeDirs", "EXCLUDE_DIRS", "node_modules,.venv,__pycache__,.git");
    return raw.split(",").map((s) => s.trim());
  },
  get llmProvider(): string {
    return settingStr("llmProvider", "LLM_PROVIDER", "claude-cli");
  },
  get llmAllowUnsafe(): boolean {
    return settingBool("llmAllowUnsafe", "LLM_ALLOW_UNSAFE", false);
  },
  get sanitizePaths(): boolean {
    return settingBool("sanitizePaths", "SANITIZE_PATHS", true);
  },
  get claudeCliModel(): string | undefined {
    const s = getSettings().claudeCliModel;
    if (s) return s;
    return process.env.CLAUDE_CLI_MODEL || undefined;
  },
  get codexCliModel(): string | undefined {
    const s = getSettings().codexCliModel;
    if (s) return s;
    return process.env.CODEX_CLI_MODEL || undefined;
  },
  get llmDebug(): boolean {
    return settingBool("llmDebug", "LLM_DEBUG", false);
  },
  get llmOverwriteMetadata(): boolean {
    return settingBool("llmOverwriteMetadata", "LLM_OVERWRITE_METADATA", false);
  },
  get llmConcurrency(): number {
    const s = getSettings().llmConcurrency;
    if (typeof s === "number" && s > 0) return s;
    const v = process.env.LLM_CONCURRENCY;
    if (v === undefined) return 3;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 3;
  },
  // Provider-specific settings
  get openrouterApiKey(): string | undefined {
    return process.env.OPENROUTER_API_KEY || undefined;
  },
  get openrouterModel(): string {
    return settingStr("openrouterModel", "OPENROUTER_MODEL", "anthropic/claude-sonnet-4");
  },
  get ollamaUrl(): string {
    return settingStr("ollamaUrl", "OLLAMA_URL", "http://localhost:11434");
  },
  get ollamaModel(): string {
    return settingStr("ollamaModel", "OLLAMA_MODEL", "llama3");
  },
  get mlxUrl(): string {
    return settingStr("mlxUrl", "MLX_URL", "http://localhost:8080");
  },
  get mlxModel(): string {
    return settingStr("mlxModel", "MLX_MODEL", "default");
  },
  get hasCompletedOnboarding(): boolean {
    return settingBool("hasCompletedOnboarding", "HAS_COMPLETED_ONBOARDING", false);
  },
} as const;
