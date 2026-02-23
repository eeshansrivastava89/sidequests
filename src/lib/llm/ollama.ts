import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";

/**
 * Ollama provider — calls a local Ollama instance.
 * Requires Ollama running locally. Configure model with OLLAMA_MODEL.
 */
export const ollamaProvider: LlmProvider = {
  name: "ollama",

  async enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment> {
    const baseUrl = config.ollamaUrl;
    const model = config.ollamaModel;

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(input) },
        ],
      }),
      signal: signal ?? AbortSignal.timeout(config.llmTimeout),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.message?.content;
    if (!content) throw new Error("Empty response from Ollama");

    return parseEnrichment(content);
  },
};
