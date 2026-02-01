import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";

/**
 * MLX provider — calls a local mlx-lm-server (OpenAI-compatible API).
 * Requires mlx-lm-server running locally. Configure with MLX_URL and MLX_MODEL.
 */
export const mlxProvider: LlmProvider = {
  name: "mlx",

  async enrich(input: LlmInput): Promise<LlmEnrichment> {
    const baseUrl = process.env.MLX_URL || "http://localhost:8080";
    const model = process.env.MLX_MODEL || "default";

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(input) },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      throw new Error(`MLX server error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from MLX server");

    return parseEnrichment(content);
  },
};
