import { config } from "../config";
import type { LlmProvider } from "./provider";
import { claudeCliProvider } from "./claude-cli";
import { openrouterProvider } from "./openrouter";
import { ollamaProvider } from "./ollama";
import { mlxProvider } from "./mlx";
import { codexCliProvider } from "./codex-cli";

export type { LlmProvider, LlmInput, LlmEnrichment, AiInsight } from "./provider";

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
 * Returns the active LLM provider, or null if LLM is disabled.
 * Provider is selected by LLM_PROVIDER env var (default: claude-cli).
 * Unsafe providers (codex-cli) require LLM_ALLOW_UNSAFE=true.
 */
export function getLlmProvider(): LlmProvider | null {
  if (!config.featureLlm) return null;

  const name = config.llmProvider;

  // Check unsafe providers first
  const unsafe = unsafeProviders[name];
  if (unsafe) {
    if (!config.llmAllowUnsafe) {
      throw new Error(
        `LLM_PROVIDER "${name}" can perform agentic actions (file edits, commands). ` +
        `Set LLM_ALLOW_UNSAFE=true to enable it.`
      );
    }
    return unsafe;
  }

  const provider = providers[name];
  if (!provider) {
    const all = [...Object.keys(providers), ...Object.keys(unsafeProviders)];
    throw new Error(
      `Unknown LLM_PROVIDER "${name}". Available: ${all.join(", ")}`
    );
  }
  return provider;
}
