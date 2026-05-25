import type { LlmProvider, LlmInput, LlmEnrichment } from "./provider";
import { SYSTEM_PROMPT, buildPrompt, parseEnrichment } from "./prompt";
import { config } from "../config";

/**
 * MLX provider — calls a local mlx-lm-server (OpenAI-compatible API).
 * Requires mlx-lm-server running locally. Configure with MLX_URL and MLX_MODEL.
 */
export const mlxProvider: LlmProvider = {
  name: "mlx",

  async enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment> {
    const baseUrl = config.mlxUrl;
    const model = config.mlxModel;

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
      signal: signal ?? AbortSignal.timeout(config.llmTimeout),
    });

    if (!res.ok) {
      throw new Error(`MLX server error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from MLX server");

    return parseEnrichment(content);
  },

  async analyze(prompt: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${config.mlxUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.mlxModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
      signal: signal ?? AbortSignal.timeout(config.llmTimeout * 2),
    });
    if (!res.ok) throw new Error(`MLX server error: ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from MLX server");
    return content;
  },
};
