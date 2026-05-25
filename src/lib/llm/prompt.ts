import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { LlmInput, LlmEnrichment, LlmStatus, Insight, InsightSeverity } from "./provider";
import { config } from "../config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "..", "config", "prompts");

/** Try to parse a JSON object from an LLM response.
 * Handles string responses, markdown fences, and partial JSON wrapping.
 * Uses balanced-brace matching to avoid greedy overcapture.
 * Returns null if parsing fails entirely. */
export function tryParseLlmJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  // Strip markdown code fences
  const stripped = raw.replace(/```(?:json)?\s*/g, "").replace(/\s*```/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Find the first balanced brace group
    const firstBrace = stripped.indexOf("{");
    if (firstBrace === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < stripped.length; i++) {
      const ch = stripped[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      if (depth === 0) {
        const candidate = stripped.slice(firstBrace, i + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
    return null;
  }
}

export const SYSTEM_PROMPT = readFileSync(join(PROMPTS_DIR, "project-system.md"), "utf-8").trim();
const USER_TEMPLATE = readFileSync(join(PROMPTS_DIR, "project-user.md"), "utf-8").trim();

const VALID_STATUSES = new Set<LlmStatus>(["building", "shipping", "maintaining", "blocked", "completed", "idea"]);

export function buildPrompt(input: LlmInput): string {
  let prompt = USER_TEMPLATE
    .replace("{{name}}", input.name)
    .replace("{{path}}", input.path)
    .replace("{{statusAuto}}", input.derived.statusAuto)
    .replace("{{healthScore}}", String(input.derived.healthScoreAuto))
    .replace("{{hygieneScore}}", String(input.derived.hygieneScoreAuto))
    .replace("{{momentumScore}}", String(input.derived.momentumScoreAuto))
    .replace("{{tags}}", input.derived.tags.join(", ") || "none")
    .replace("{{scanData}}", JSON.stringify(input.scan, null, 2));

  if (input.github) {
    let githubBlock = `GitHub data:\nOpen Issues: ${input.github.openIssues}\nOpen PRs: ${input.github.openPrs}\nCI Status: ${input.github.ciStatus}\nRepo Visibility: ${input.github.repoVisibility}`;
    if (input.github.topIssues) githubBlock += `\nTop Issues: ${input.github.topIssues}`;
    if (input.github.topPrs) githubBlock += `\nTop PRs: ${input.github.topPrs}`;
    prompt = prompt.replace("{{githubBlock}}", githubBlock);
  } else {
    prompt = prompt.replace("{{githubBlock}}", "");
  }

  if (input.previousSummary) {
    prompt = prompt.replace("{{previousSummaryBlock}}", `\nPrevious summary (for continuity): ${input.previousSummary}`);
  } else {
    prompt = prompt.replace("{{previousSummaryBlock}}", "");
  }

  if (config.llmDebug) {
    console.log(`[llm] Prompt for ${input.name} (~${prompt.length} chars):\n${prompt.slice(0, 1200)}${prompt.length > 1200 ? "\n..." : ""}`);
  }

  return prompt;
}

/**
 * Safely parse an LLM response string into an LlmEnrichment,
 * applying defaults for any missing fields.
 */
export function parseEnrichment(raw: unknown): LlmEnrichment {
  const obj = tryParseLlmJson(raw);

  const summary = typeof obj?.summary === "string" ? obj.summary : "";
  const nextAction = typeof obj?.nextAction === "string" && obj.nextAction
    ? obj.nextAction
    : "Review project and decide next step";
  const rawStatus = typeof obj?.status === "string" ? obj.status as LlmStatus : "idea";
  const status: LlmStatus = VALID_STATUSES.has(rawStatus) ? rawStatus : "idea";
  const statusReason = typeof obj?.statusReason === "string" ? obj.statusReason : "";
  const tags = Array.isArray(obj?.tags)
    ? obj.tags.filter((t): t is string => typeof t === "string")
    : [];
  const VALID_SEVERITIES = new Set<InsightSeverity>(["green", "amber", "red"]);
  const insights: Insight[] = Array.isArray(obj?.insights)
    ? obj.insights
        .map((r): Insight | null => {
          if (typeof r === "string") return { text: r, severity: "amber" };
          if (r && typeof r === "object" && typeof r.text === "string") {
            const sev = VALID_SEVERITIES.has(r.severity) ? r.severity : "amber";
            return { text: r.text, severity: sev };
          }
          return null;
        })
        .filter((r): r is Insight => r !== null)
    : [];

  const framework = typeof obj?.framework === "string" ? obj.framework : null;
  const primaryLanguage = typeof obj?.primaryLanguage === "string" ? obj.primaryLanguage : null;

  return { summary, nextAction, status, statusReason, tags, insights, framework, primaryLanguage };
}
