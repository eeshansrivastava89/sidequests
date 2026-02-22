import path from "path";
import os from "os";
import { getSettings } from "./settings";

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

export const config = {
  get devRoot(): string {
    return expandHome(getSettings().devRoot ?? "~/dev");
  },
  get excludeDirs(): string[] {
    const raw = getSettings().excludeDirs ?? "node_modules,.venv,__pycache__,.git";
    return raw.split(",").map((s) => s.trim());
  },
  get llmProvider(): string {
    return getSettings().llmProvider ?? "claude-cli";
  },
  get llmAllowUnsafe(): boolean {
    return getSettings().llmAllowUnsafe ?? false;
  },
  get claudeCliModel(): string | undefined {
    return getSettings().claudeCliModel || undefined;
  },
  get codexCliModel(): string | undefined {
    return getSettings().codexCliModel || undefined;
  },
  get llmDebug(): boolean {
    return getSettings().llmDebug ?? false;
  },
  get llmOverwriteMetadata(): boolean {
    return getSettings().llmOverwriteMetadata ?? false;
  },
  get llmConcurrency(): number {
    const s = getSettings().llmConcurrency;
    return typeof s === "number" && s > 0 ? s : 3;
  },
  get openrouterApiKey(): string | undefined {
    return getSettings().openrouterApiKey || undefined;
  },
  get openrouterModel(): string {
    return getSettings().openrouterModel ?? "anthropic/claude-sonnet-4";
  },
  get ollamaUrl(): string {
    return getSettings().ollamaUrl ?? "http://localhost:11434";
  },
  get ollamaModel(): string {
    return getSettings().ollamaModel ?? "llama3";
  },
  get mlxUrl(): string {
    return getSettings().mlxUrl ?? "http://localhost:8080";
  },
  get mlxModel(): string {
    return getSettings().mlxModel ?? "default";
  },
  get hasCompletedOnboarding(): boolean {
    return getSettings().hasCompletedOnboarding ?? false;
  },
} as const;
