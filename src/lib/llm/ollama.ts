import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";

/**
 * Ollama provider — calls a local Ollama instance.
 * Requires Ollama running locally. Configure model with OLLAMA_MODEL.
 */
export const ollamaProvider: LlmProvider = {
  name: "ollama",

  async enrich(input: LlmInput): Promise<LlmEnrichment> {
    const baseUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL || "llama3";

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
      signal: AbortSignal.timeout(120_000),
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
