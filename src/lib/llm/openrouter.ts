import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";

/**
 * OpenRouter provider — calls the OpenRouter chat completions API.
 * Requires openrouterApiKey in settings.json.
 */
export const openrouterProvider: LlmProvider = {
  name: "openrouter",

  async enrich(input: LlmInput): Promise<LlmEnrichment> {
    const apiKey = config.openrouterApiKey;
    if (!apiKey) {
      throw new Error("openrouterApiKey is required — set it in Settings");
    }
    const model = config.openrouterModel;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(input) },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenRouter");

    return parseEnrichment(content);
  },
};
