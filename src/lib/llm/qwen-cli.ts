import { spawn } from "child_process";
import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";

function runQwen(prompt: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;
    delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;

    const child = spawn(
      "qwen",
      [
        "-p", prompt,
        "--output-format", "json",
        "--approval-mode", "auto_edit",
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
      settle(() => reject(new Error(`qwen CLI timed out after ${timeoutMs / 1000}s`)));
    }, timeoutMs);

    const abortHandler = signal ? () => {
      child.kill();
      settle(() => reject(new Error("Aborted")));
    } : undefined;
    if (abortHandler) signal!.addEventListener("abort", abortHandler);

    child.on("error", (err) => settle(() => reject(err)));
    child.on("close", (code) => {
      if (code === 0) {
        try {
          const messages = JSON.parse(stdout);
          const resultMsg = messages.find((m: Record<string, unknown>) => m.type === "result");
          const text = resultMsg?.result as string || "";
          resolve(text);
        } catch {
          resolve(stdout);
        }
      } else {
        reject(new Error(`qwen exited ${code}: ${stderr || stdout}`));
      }
    });
  });
}

export const qwenCliProvider: LlmProvider = {
  name: "qwen-cli",

  async enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment> {
    const prompt = buildPrompt(input);
    const text = await runQwen(prompt, signal);

    if (config.llmDebug) {
      console.log(`[llm-debug] ${input.name} raw output:\n${text}`);
    }

    return parseEnrichment(text);
  },
};
