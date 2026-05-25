import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";
import { runCli } from "./cli-utils";

/**
 * Claude CLI provider — calls `claude -p` with system prompt injection.
 * Requires `claude` CLI installed and authenticated.
 */
export const claudeCliProvider: LlmProvider = {
  name: "claude-cli",

  async enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment> {
    const prompt = buildPrompt(input);

    if (config.llmDebug) {
      console.log(`[claude-cli] Starting enrichment for ${input.name}`);
    }

    const { stdout, stderr } = await runCli({
      command: "claude",
      args: [
        "-p",
        "--output-format", "text",
        "--append-system-prompt", SYSTEM_PROMPT,
        ...(config.claudeCliModel ? ["--model", config.claudeCliModel] : []),
      ],
      stdinData: prompt,
      timeoutMs: config.llmTimeout,
      signal,
    });

    if (config.llmDebug) {
      console.log(`[claude-cli] ${input.name} raw output (${stdout.length} chars):\n${stdout.slice(0, 500)}${stdout.length > 500 ? "..." : ""}`);
      if (stderr) console.log(`[claude-cli] ${input.name} stderr:\n${stderr.slice(0, 300)}`);
    }

    return parseEnrichment(stdout);
  },

  async analyze(prompt: string, signal?: AbortSignal): Promise<string> {
    const { stdout } = await runCli({
      command: "claude",
      args: [
        "-p",
        "--output-format", "text",
        ...(config.claudeCliModel ? ["--model", config.claudeCliModel] : []),
      ],
      stdinData: prompt,
      timeoutMs: config.llmTimeout * 2, // Portfolio analysis takes longer
      signal,
    });
    return stdout;
  },
};
