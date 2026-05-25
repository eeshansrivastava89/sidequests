import { tmpdir } from "os";
import { join } from "path";
import { readFileSync, unlinkSync } from "fs";
import { randomBytes } from "crypto";
import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";
import { runCli } from "./cli-utils";

/**
 * Codex CLI provider — calls `codex exec` in read-only sandbox mode.
 *
 * Key design decisions:
 * - `--sandbox read-only` — this is an analysis task, no writes needed.
 * - `--ephemeral` — don't persist session files to disk.
 * - `-o <file>` — captures only the final agent message (stdout may
 *   contain tool-call traces and other agent output).
 * - System prompt is prepended to the user message because `codex exec`
 *   does not have a `--system-prompt` or `--append-system-prompt` flag.
 * - Prompt is piped via stdin (`-` arg) to avoid shell arg-length limits.
 *
 * Requires `codex` CLI installed and configured (API key in ~/.codex/config.toml).
 */
export const codexCliProvider: LlmProvider = {
  name: "codex-cli",

  async enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment> {
    if (config.llmDebug) {
      console.log(`[codex-cli] Starting enrichment for ${input.name}`);
    }

    // Codex has no --system-prompt flag, so we prepend it to the user message.
    const prompt = `${SYSTEM_PROMPT}\n\n${buildPrompt(input)}`;
    const outputFile = join(
      tmpdir(),
      `sidequests-codex-${randomBytes(8).toString("hex")}.txt`,
    );

    try {
      const { stderr } = await runCli({
        command: "codex",
        args: [
          "exec",
          "--sandbox", "read-only",
          "--ephemeral",
          ...(config.codexCliModel ? ["-m", config.codexCliModel] : []),
          "-o", outputFile,
          "-", // read prompt from stdin
        ],
        stdinData: prompt,
        timeoutMs: config.llmTimeout,
        signal,
      });

      let text: string;
      try {
        text = readFileSync(outputFile, "utf-8");
      } catch {
        throw new Error(
          "Codex did not produce output (missing output file). " +
          (stderr ? `stderr: ${stderr}` : "No stderr."),
        );
      }

      if (!text.trim()) {
        throw new Error(
          "Codex produced an empty response. " +
          (stderr ? `stderr: ${stderr}` : ""),
        );
      }

      if (config.llmDebug) {
        console.log(`[codex-cli] ${input.name} raw output (${text.length} chars):\n${text.slice(0, 500)}${text.length > 500 ? "..." : ""}`);
        if (stderr) console.log(`[codex-cli] ${input.name} stderr:\n${stderr.slice(0, 300)}`);
      }

      return parseEnrichment(text);
    } finally {
      try { unlinkSync(outputFile); } catch { /* temp file cleanup */ }
    }
  },

  async analyze(prompt: string, signal?: AbortSignal): Promise<string> {
    const { stdout } = await runCli({
      command: "codex",
      args: ["-q", "--full-auto", ...(config.codexCliModel ? ["--model", config.codexCliModel] : [])],
      stdinData: prompt,
      timeoutMs: config.llmTimeout * 2,
      signal,
    });
    return stdout;
  },
};
