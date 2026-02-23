import { execFile } from "child_process";
import { promisify } from "util";
import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";

const execFileAsync = promisify(execFile);

/**
 * Codex CLI provider — calls the OpenAI Codex CLI.
 * Requires `codex` CLI installed and configured.
 */
export const codexCliProvider: LlmProvider = {
  name: "codex-cli",

  async enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment> {
    if (signal?.aborted) throw new Error("Aborted");
    const prompt = buildPrompt(input);

    const { stdout } = await execFileAsync(
      "codex",
      [
        "exec",
        "--full-auto",
        ...(config.codexCliModel ? ["--model", config.codexCliModel] : []),
        prompt,
      ],
      { timeout: config.llmTimeout, maxBuffer: 1024 * 1024 }
    );

    return parseEnrichment(stdout);
  },
};
