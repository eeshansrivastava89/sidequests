import path from "path";
import os from "os";

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

export const config = {
  get devRoot(): string {
    return expandHome(process.env.DEV_ROOT || "~/dev");
  },
  get excludeDirs(): string[] {
    const raw = process.env.EXCLUDE_DIRS || "_projects_dashboard,node_modules,.venv,__pycache__,.git";
    return raw.split(",").map((s) => s.trim());
  },
  get featureLlm(): boolean {
    return envBool("FEATURE_LLM", false);
  },
  get featureO1(): boolean {
    return envBool("FEATURE_O1", false);
  },
  get llmProvider(): string {
    return process.env.LLM_PROVIDER || "claude-cli";
  },
  get llmAllowUnsafe(): boolean {
    return envBool("LLM_ALLOW_UNSAFE", false);
  },
  get sanitizePaths(): boolean {
    return envBool("SANITIZE_PATHS", true);
  },
  get claudeCliModel(): string | undefined {
    return process.env.CLAUDE_CLI_MODEL || undefined;
  },
  get llmDebug(): boolean {
    return envBool("LLM_DEBUG", false);
  },
  get llmOverwriteMetadata(): boolean {
    return envBool("LLM_OVERWRITE_METADATA", false);
  },
  get llmForce(): boolean {
    return envBool("LLM_FORCE", false);
  },
  get llmConcurrency(): number {
    const v = process.env.LLM_CONCURRENCY;
    if (v === undefined) return 3;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 3;
  },
} as const;
