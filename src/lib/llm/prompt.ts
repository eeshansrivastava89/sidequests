import type { LlmInput, LlmEnrichment, LlmStatus } from "./provider";

const VALID_STATUSES = new Set<LlmStatus>(["building", "shipping", "maintaining", "blocked", "stale", "idea"]);

export const SYSTEM_PROMPT = `You are a developer project analyst. Given a project's scan data, derived metrics, and optional GitHub data, produce a JSON object with these exact fields:

- "summary": A 1-2 sentence description of what this project does and its current state.
- "nextAction": The single most important thing the developer should do next. Always provide a concrete, actionable step.
- "status": One of "building", "shipping", "maintaining", "blocked", "stale", or "idea".
  - "building": actively being developed, frequent commits, features in progress
  - "shipping": ready or nearly ready for release/deployment
  - "maintaining": stable, only bug fixes or minor updates
  - "blocked": has open issues or PRs blocking progress, CI failures, or unresolved problems
  - "stale": no recent activity, needs attention or archiving decision
  - "idea": early stage, minimal code, exploration phase
- "statusReason": A short explanation of why you chose this status.
- "tags": An array of 3-8 descriptive tags (technology, domain, type).
- "insights": An array of 3-5 distinct observations. Each should state the concern AND the suggested action in a single sentence. Do not repeat the same issue in multiple bullets. Combine risks and recommendations into unified insights.
- "framework": The primary framework or meta-framework (e.g. "Next.js", "Astro", "FastAPI", "Axum"). null if none detected.
- "primaryLanguage": The dominant programming language (e.g. "TypeScript", "Python", "Rust", "HTML/CSS"). null if unclear.

Respond ONLY with valid JSON, no markdown fences or commentary.`;

export function buildPrompt(input: LlmInput): string {
  let prompt = `Analyze this project and respond with ONLY a JSON object (no markdown fences, no commentary):

{
  "summary": "1-2 sentence description + current state",
  "nextAction": "single most important next step",
  "status": "building|shipping|maintaining|blocked|stale|idea",
  "statusReason": "why this status",
  "tags": ["3-8 descriptive tags"],
  "insights": ["3-5 distinct observations combining concern + action"],
  "framework": "primary framework or null",
  "primaryLanguage": "dominant language or null"
}

Project data:

Name: ${input.name}
Path: ${input.path}
Status: ${input.derived.statusAuto}
Health Score: ${input.derived.healthScoreAuto}/100
Hygiene Score: ${input.derived.hygieneScoreAuto}/100
Momentum Score: ${input.derived.momentumScoreAuto}/100
Derived Tags: ${input.derived.tags.join(", ") || "none"}

Raw scan data:
${JSON.stringify(input.scan, null, 2)}`;

  if (input.github) {
    prompt += `

GitHub data:
Open Issues: ${input.github.openIssues}
Open PRs: ${input.github.openPrs}
CI Status: ${input.github.ciStatus}
Repo Visibility: ${input.github.repoVisibility}`;
    if (input.github.topIssues) {
      prompt += `\nTop Issues: ${input.github.topIssues}`;
    }
    if (input.github.topPrs) {
      prompt += `\nTop PRs: ${input.github.topPrs}`;
    }
  }

  if (input.previousSummary) {
    prompt += `

Previous summary (for continuity): ${input.previousSummary}`;
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
  const insights = Array.isArray(obj?.insights)
    ? obj.insights.filter((r): r is string => typeof r === "string")
    : [];

  const framework = typeof obj?.framework === "string" ? obj.framework : null;
  const primaryLanguage = typeof obj?.primaryLanguage === "string" ? obj.primaryLanguage : null;

  return { summary, nextAction, status, statusReason, tags, insights, framework, primaryLanguage };
}
