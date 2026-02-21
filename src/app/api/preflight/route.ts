import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { config } from "@/lib/config";

interface PreflightCheck {
  name: string;
  ok: boolean;
  message: string;
}

function checkBinary(name: string, command: string, hint?: string): PreflightCheck {
  try {
    const version = execSync(`${command} --version`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return { name, ok: true, message: version };
  } catch {
    const msg = hint ? `${name} not found on PATH. ${hint}` : `${name} not found on PATH`;
    return { name, ok: false, message: msg };
  }
}

async function checkUrl(name: string, url: string, hint?: string): Promise<PreflightCheck> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return { name, ok: res.ok, message: res.ok ? `Reachable at ${url}` : `HTTP ${res.status}` };
  } catch {
    const msg = hint ? `Cannot reach ${url}. ${hint}` : `Cannot reach ${url}`;
    return { name, ok: false, message: msg };
  }
}

export async function GET() {
  const checks: PreflightCheck[] = [];

  // Core dependencies (git only — pipeline is TS-native, no Python required)
  checks.push(checkBinary("git", "git"));

  // Provider-specific checks (only when a provider is configured)
  const provider = config.llmProvider;
  if (provider && provider !== "none") {

    switch (provider) {
      case "claude-cli":
        checks.push(checkBinary("claude", "claude", "Install with: npm install -g @anthropic-ai/claude-code"));
        break;
      case "openrouter": {
        const hasKey = !!(process.env.OPENROUTER_API_KEY || config.openrouterApiKey);
        checks.push({
          name: "openrouter",
          ok: hasKey,
          message: hasKey ? "API key configured" : "OPENROUTER_API_KEY not set (configure in Settings)",
        });
        break;
      }
      case "ollama": {
        const url = config.ollamaUrl || "http://localhost:11434";
        checks.push(await checkUrl("ollama", url, "Is Ollama running? Try: ollama serve"));
        break;
      }
      case "mlx": {
        const url = config.mlxUrl || "http://localhost:8080";
        checks.push(await checkUrl("mlx", url, "Is the MLX server running on the expected port?"));
        break;
      }
      case "codex-cli": {
        checks.push(checkBinary("codex", "codex"));
        if (!config.llmAllowUnsafe) {
          checks.push({
            name: "codex-cli-unsafe",
            ok: false,
            message: "codex-cli requires Allow Unsafe to be enabled in Settings",
          });
        }
        break;
      }
    }
  }

  return NextResponse.json({ checks });
}
