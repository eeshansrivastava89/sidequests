import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";
import { runCli } from "./cli-utils";

/**
 * Qwen CLI provider — calls `qwen` in plan-only approval mode.
 *
 * Key design decisions:
 * - `--approval-mode plan` — read-only analysis, no file edits allowed.
 * - `--system-prompt` — injects the analyst persona and JSON schema.
 * - `--output-format json` — returns structured message array.
 * - Prompt is passed as a positional arg (one-shot mode).
 *   Using the positional (not deprecated `-p` flag) per Qwen docs.
 * - Model selection via `-m` when `qwenCliModel` is configured.
 *
 * Requires `qwen` CLI installed and authenticated.
 */
export const qwenCliProvider: LlmProvider = {
  name: "qwen-cli",

  async enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment> {
    if (config.llmDebug) {
      console.log(`[qwen-cli] Starting enrichment for ${input.name}`);
    }

    const prompt = buildPrompt(input);

    const { stdout, stderr } = await runCli({
      command: "qwen",
      args: [
        "--output-format", "json",
        "--approval-mode", "plan",
        "--system-prompt", SYSTEM_PROMPT,
        ...(config.qwenCliModel ? ["-m", config.qwenCliModel] : []),
        prompt, // positional arg = one-shot mode
      ],
      timeoutMs: config.llmTimeout,
      signal,
    });

    // --output-format json returns a JSON array of message objects.
    // Look for { type: "result", result: "..." } to extract final answer.
    let text = stdout;
    try {
      const messages = JSON.parse(stdout);
      if (Array.isArray(messages)) {
        const resultMsg = messages.find(
          (m: Record<string, unknown>) => m.type === "result",
        );
        if (resultMsg) {
          text = (resultMsg.result as string) || (resultMsg.message as string) || "";
        }
      }
    } catch {
      // If stdout isn't valid JSON, fall through to raw text parsing
    }

    if (!text.trim()) {
      throw new Error(
        "Empty response from Qwen CLI" +
        (stderr ? `. stderr: ${stderr}` : ""),
      );
    }

    if (config.llmDebug) {
      console.log(`[qwen-cli] ${input.name} raw output (${text.length} chars):\n${text.slice(0, 500)}${text.length > 500 ? "..." : ""}`);
      if (stderr) console.log(`[qwen-cli] ${input.name} stderr:\n${stderr.slice(0, 300)}`);
    }

    return parseEnrichment(text);
  },

  async analyze(prompt: string, signal?: AbortSignal): Promise<string> {
    const { stdout } = await runCli({
      command: "qwen",
      args: [],
      stdinData: prompt,
      timeoutMs: config.llmTimeout * 2,
      signal,
    });
    return stdout;
  },
};
