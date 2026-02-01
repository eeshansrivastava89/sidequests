import { execFile } from "child_process";
import { promisify } from "util";
import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { buildPrompt, parseEnrichment } from "./prompt";

const execFileAsync = promisify(execFile);

/**
 * Codex CLI provider — calls the OpenAI Codex CLI.
 * Requires `codex` CLI installed and configured.
 */
export const codexCliProvider: LlmProvider = {
  name: "codex-cli",

  async enrich(input: LlmInput): Promise<LlmEnrichment> {
    const prompt = buildPrompt(input);

    const { stdout } = await execFileAsync(
      "codex",
      ["exec", "--full-auto", prompt],
      { timeout: 120_000, maxBuffer: 1024 * 1024 }
    );

    return parseEnrichment(stdout);
  },
};
