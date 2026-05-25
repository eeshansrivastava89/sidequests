import type { LlmInput, LlmEnrichment, LlmStatus, Insight, InsightSeverity } from "./provider";
import projectSystemPrompt from "@/config/prompts/project-system.md?raw";
import projectUserTemplate from "@/config/prompts/project-user.md?raw";

const VALID_STATUSES = new Set<LlmStatus>(["building", "shipping", "maintaining", "blocked", "completed", "idea"]);

export const SYSTEM_PROMPT = projectSystemPrompt;

export function buildPrompt(input: LlmInput): string {
  let prompt = projectUserTemplate
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

  return prompt;
}

/**
 * Safely parse an LLM response string into an LlmEnrichment,
 * applying defaults for any missing fields.
 */
export function parseEnrichment(raw: unknown): LlmEnrichment {
  let obj: Record<string, unknown> | null = null;

  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          obj = JSON.parse(match[0]);
        } catch {
          // fall through to defaults
        }
      }
    }
  } else {
    obj = raw as Record<string, unknown>;
  }

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
