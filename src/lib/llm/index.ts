import { config } from "../config";
import type { LlmProvider } from "./provider";
import { claudeCliProvider } from "./claude-cli";
import { openrouterProvider } from "./openrouter";
import { ollamaProvider } from "./ollama";
import { mlxProvider } from "./mlx";
import { codexCliProvider } from "./codex-cli";

export type { LlmProvider, LlmInput, LlmEnrichment, LlmStatus } from "./provider";

const providers: Record<string, LlmProvider> = {
  "claude-cli": claudeCliProvider,
  "openrouter": openrouterProvider,
  "ollama": ollamaProvider,
  "mlx": mlxProvider,
};

/** Providers that can perform agentic actions (file writes, commands). */
const unsafeProviders: Record<string, LlmProvider> = {
  "codex-cli": codexCliProvider,
};

/**
 * Returns the active LLM provider, or null if provider is "none" or unconfigured.
 * Provider is selected by llmProvider in settings.json (default: claude-cli).
 * Unsafe providers (codex-cli) require llmAllowUnsafe=true.
 */
export function getLlmProvider(): LlmProvider | null {
  const name = config.llmProvider;
  if (!name || name === "none") return null;

  // Check unsafe providers first
  const unsafe = unsafeProviders[name];
  if (unsafe) {
    if (!config.llmAllowUnsafe) {
      throw new Error(
        `Provider "${name}" can perform agentic actions (file edits, commands). ` +
        `Set llmAllowUnsafe=true in Settings to enable it.`
      );
    }
    return unsafe;
  }

  const provider = providers[name];
  if (!provider) {
    const all = [...Object.keys(providers), ...Object.keys(unsafeProviders)];
    throw new Error(
      `Unknown llmProvider "${name}". Available: ${all.join(", ")}`
    );
  }
  return provider;
}
