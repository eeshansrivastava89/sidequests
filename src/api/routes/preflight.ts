import { Router } from "express";
import { execSync } from "node:child_process";
import { config } from "@/lib/config";

interface PreflightCheck {
  name: string;
  ok: boolean;
  message: string;
  tier: "required" | "optional";
  active?: boolean;
}

function checkBinary(name: string, command: string, tier: "required" | "optional", hint?: string): PreflightCheck {
  try {
    const version = execSync(`${command} --version`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return { name, ok: true, message: version, tier };
  } catch {
    const msg = hint ? `${name} not found on PATH. ${hint}` : `${name} not found on PATH`;
    return { name, ok: false, message: msg, tier };
  }
}

async function checkUrl(name: string, url: string, tier: "required" | "optional", hint?: string): Promise<PreflightCheck> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return { name, ok: res.ok, message: res.ok ? `Reachable at ${url}` : `HTTP ${res.status}`, tier };
  } catch {
    const msg = hint ? `Cannot reach ${url}. ${hint}` : `Cannot reach ${url}`;
    return { name, ok: false, message: msg, tier };
  }
}

const PROVIDER_CHECK_NAME: Record<string, string> = {
  "claude-cli": "claude",
  "openrouter": "openrouter",
  "ollama": "ollama",
  "codex-cli": "codex",
  "qwen-cli": "qwen",
};

export const preflightRoute = Router();

// GET /api/preflight — check dependencies and LLM providers
preflightRoute.get("/", async (_req, res) => {
  const checks: PreflightCheck[] = [];
  const activeProvider = config.llmProvider;

  // Core dependencies
  checks.push(checkBinary("git", "git", "required"));

  // GitHub CLI
  const ghCheck = checkBinary("gh", "gh", "optional", "Install with: brew install gh (enables GitHub integration)");
  checks.push(ghCheck);
  if (ghCheck.ok) {
    try {
      execSync("gh auth token", { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      checks.push({ name: "gh-auth", ok: true, message: "Authenticated with GitHub", tier: "optional" });
    } catch {
      checks.push({ name: "gh-auth", ok: false, message: "gh is not authenticated. Run: gh auth login", tier: "optional" });
    }
  }

  // LLM Providers
  checks.push(checkBinary("claude", "claude", "optional", "Install with: npm install -g @anthropic-ai/claude-code"));

  // OpenRouter
  {
    const hasKey = !!config.openrouterApiKey;
    checks.push({ name: "openrouter", ok: hasKey, message: hasKey ? "API key configured" : "No API key set", tier: "optional" });
  }

  // Ollama
  {
    const url = config.ollamaUrl || "http://localhost:11434";
    checks.push(await checkUrl("ollama", url, "optional", "Is Ollama running? Try: ollama serve"));
  }

  // Codex CLI
  checks.push(checkBinary("codex", "codex", "optional", "Install with: npm install -g @openai/codex"));

  // Qwen CLI
  checks.push(checkBinary("qwen", "qwen", "optional", "Install with: npm install -g @anthropic-ai/qwen-code"));

  // Tag the active provider
  const activeCheckName = PROVIDER_CHECK_NAME[activeProvider];
  if (activeCheckName) {
    const match = checks.find((ch) => ch.name === activeCheckName);
    if (match) match.active = true;
  }

  res.json({ checks });
});