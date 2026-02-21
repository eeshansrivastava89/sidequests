import { config } from "../config";
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
- "risks": An array of 1-3 risks or concerns about the project.
- "tags": An array of 3-8 descriptive tags (technology, domain, type).
- "recommendations": An array of 2-4 actionable next steps to improve the project.

Respond ONLY with valid JSON, no markdown fences or commentary.`;

export function sanitizePath(p: string): string {
  if (!config.sanitizePaths) return p;
  const parts = p.split("/");
  if (parts.length > 2) return "~/" + parts.slice(-2).join("/");
  return p;
}

export function sanitizeScan(scan: Record<string, unknown>): Record<string, unknown> {
  if (!config.sanitizePaths) return scan;
  const copy = { ...scan };
  delete copy.path;
  delete copy.pathDisplay;
  return copy;
}

export function buildPrompt(input: LlmInput): string {
  let prompt = `Analyze this project and respond with ONLY a JSON object (no markdown fences, no commentary):

{
  "summary": "1-2 sentence description + current state",
  "nextAction": "single most important next step",
  "status": "building|shipping|maintaining|blocked|stale|idea",
  "statusReason": "why this status",
  "risks": ["1-3 risks or concerns"],
  "tags": ["3-8 descriptive tags"],
  "recommendations": ["2-4 actionable next steps"]
}

Project data:

Name: ${input.name}
Path: ${sanitizePath(input.path)}
Status: ${input.derived.statusAuto}
Health Score: ${input.derived.healthScoreAuto}/100
Hygiene Score: ${input.derived.hygieneScoreAuto}/100
Momentum Score: ${input.derived.momentumScoreAuto}/100
Derived Tags: ${input.derived.tags.join(", ") || "none"}

Raw scan data:
${JSON.stringify(sanitizeScan(input.scan), null, 2)}`;

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
  const risks = Array.isArray(obj?.risks)
    ? obj.risks.filter((r): r is string => typeof r === "string")
    : [];
  const tags = Array.isArray(obj?.tags)
    ? obj.tags.filter((t): t is string => typeof t === "string")
    : [];
  const recommendations = Array.isArray(obj?.recommendations)
    ? obj.recommendations.filter((r): r is string => typeof r === "string")
    : [];

  return { summary, nextAction, status, statusReason, risks, tags, recommendations };
}
