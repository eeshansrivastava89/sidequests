import { spawn } from "child_process";
import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";

function runClaude(prompt: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    // Strip Claude Code session markers so the child process doesn't think it's nested
    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;
    delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;

    const child = spawn(
      "claude",
      [
        "-p",
        "--output-format", "text",
        "--append-system-prompt", SYSTEM_PROMPT,
        ...(config.claudeCliModel ? ["--model", config.claudeCliModel] : []),
      ],
      { stdio: ["pipe", "pipe", "pipe"], env: cleanEnv }
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (abortHandler) signal?.removeEventListener("abort", abortHandler);
      fn();
    };

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    const timeoutMs = config.llmTimeout;
    const timer = setTimeout(() => {
      child.kill();
      settle(() => reject(new Error(`claude CLI timed out after ${timeoutMs / 1000}s`)));
    }, timeoutMs);

    // Kill child process when abort signal fires
    const abortHandler = signal ? () => {
      child.kill();
      settle(() => reject(new Error("Aborted")));
    } : undefined;
    if (abortHandler) signal!.addEventListener("abort", abortHandler);

    child.on("error", (err) => settle(() => reject(err)));
    child.on("close", (code) => settle(() => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude exited ${code}: ${stderr || stdout}`));
    }));

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export const claudeCliProvider: LlmProvider = {
  name: "claude-cli",

  async enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment> {
    const prompt = buildPrompt(input);
    const text = await runClaude(prompt, signal);

    if (config.llmDebug) {
      console.log(`[llm-debug] ${input.name} raw output:\n${text}`);
    }

    return parseEnrichment(text);
  },
};
