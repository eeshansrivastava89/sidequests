import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { config } from "@/lib/config";

interface PreflightCheck {
  name: string;
  ok: boolean;
  message: string;
  /** "required" = blocks core functionality, "optional" = enhances experience */
  tier: "required" | "optional";
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

export async function GET() {
  const checks: PreflightCheck[] = [];

  // Core dependencies — required for basic functionality
  checks.push(checkBinary("git", "git", "required"));

  // GitHub CLI — optional (enables GitHub data: issues, PRs, CI status)
  const ghCheck = checkBinary("gh", "gh", "optional", "Install with: brew install gh (enables GitHub integration)");
  checks.push(ghCheck);
  if (ghCheck.ok) {
    try {
      execSync("gh auth status", { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      checks.push({ name: "gh-auth", ok: true, message: "Authenticated with GitHub", tier: "optional" });
    } catch {
      checks.push({ name: "gh-auth", ok: false, message: "gh is not authenticated. Run: gh auth login", tier: "optional" });
    }
  }

  // LLM provider — optional (enables summaries, next actions, risks)
  const provider = config.llmProvider;
  if (provider && provider !== "none") {
    switch (provider) {
      case "claude-cli":
        checks.push(checkBinary("claude", "claude", "optional", "Install with: npm install -g @anthropic-ai/claude-code"));
        break;
      case "openrouter": {
        const hasKey = !!(process.env.OPENROUTER_API_KEY || config.openrouterApiKey);
        checks.push({
          name: "openrouter",
          ok: hasKey,
          message: hasKey ? "API key configured" : "OPENROUTER_API_KEY not set (configure in Settings)",
          tier: "optional",
        });
        break;
      }
      case "ollama": {
        const url = config.ollamaUrl || "http://localhost:11434";
        checks.push(await checkUrl("ollama", url, "optional", "Is Ollama running? Try: ollama serve"));
        break;
      }
      case "mlx": {
        const url = config.mlxUrl || "http://localhost:8080";
        checks.push(await checkUrl("mlx", url, "optional", "Is the MLX server running on the expected port?"));
        break;
      }
      case "codex-cli": {
        checks.push(checkBinary("codex", "codex", "optional"));
        if (!config.llmAllowUnsafe) {
          checks.push({
            name: "codex-cli-unsafe",
            ok: false,
            message: "codex-cli requires Allow Unsafe to be enabled in Settings",
            tier: "optional",
          });
        }
        break;
      }
    }
  }

  return NextResponse.json({ checks });
}
