import { config } from "../config";
import type { LlmInput, LlmEnrichment } from "./provider";

export const SYSTEM_PROMPT = `You are a developer portfolio analyst. Given a project's scan data and derived metrics, produce a JSON object with these exact fields:

- "purpose": A 1-2 sentence description of what this project does.
- "tags": An array of 3-8 descriptive tags (technology, domain, type).
- "notableFeatures": An array of 2-5 notable aspects of this project.
- "recommendations": An array of 2-4 actionable next steps to improve the project.

Respond ONLY with valid JSON, no markdown fences or commentary.`;

function sanitizePath(p: string): string {
  if (!config.sanitizePaths) return p;
  const parts = p.split("/");
  if (parts.length > 2) return "~/" + parts.slice(-2).join("/");
  return p;
}

function sanitizeScan(scan: Record<string, unknown>): Record<string, unknown> {
  if (!config.sanitizePaths) return scan;
  const copy = { ...scan };
  // Remove fields that contain absolute paths
  delete copy.path;
  delete copy.pathDisplay;
  return copy;
}

export function buildPrompt(input: LlmInput): string {
  const metadataFields = config.featureO1
    ? `,
  "goal": "1 sentence project goal",
  "audience": "who this project is for",
  "successMetrics": "how success is measured",
  "nextAction": "single most important next step",
  "publishTarget": "where this should be published/deployed",
  "evidence": { "skills": ["demonstrated skills"], "complexity": "low|medium|high", "impact": "description of impact" },
  "outcomes": { "status": "description of current outcome", "learnings": ["key learnings"] }`
    : "";

  return `Analyze this project and respond with ONLY a JSON object (no markdown fences, no commentary):

{
  "purpose": "1-2 sentence description",
  "tags": ["3-8 descriptive tags"],
  "notableFeatures": ["2-5 notable aspects"],
  "recommendations": ["2-4 actionable next steps"]${metadataFields}
}

Project data:

Name: ${input.name}
Path: ${sanitizePath(input.path)}
Status: ${input.derived.statusAuto}
Health Score: ${input.derived.healthScoreAuto}/100
Derived Tags: ${input.derived.tags.join(", ") || "none"}

Raw scan data:
${JSON.stringify(sanitizeScan(input.scan), null, 2)}`;
}

/**
 * Safely parse an LLM response string into an LlmEnrichment,
 * applying defaults for any missing fields.
 */
export function parseEnrichment(raw: unknown): LlmEnrichment {
  let obj: Record<string, unknown> | null = null;

  if (typeof raw === "string") {
    // Try direct parse first; fall back to extracting a JSON block from the response
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

  const base: LlmEnrichment = {
    purpose: typeof obj?.purpose === "string" ? obj.purpose : "",
    tags: Array.isArray(obj?.tags) ? obj.tags : [],
    notableFeatures: Array.isArray(obj?.notableFeatures) ? obj.notableFeatures : [],
    recommendations: Array.isArray(obj?.recommendations) ? obj.recommendations : [],
  };

  // Extract optional metadata fields
  if (typeof obj?.goal === "string") base.goal = obj.goal;
  if (typeof obj?.audience === "string") base.audience = obj.audience;
  if (typeof obj?.successMetrics === "string") base.successMetrics = obj.successMetrics;
  if (typeof obj?.nextAction === "string") base.nextAction = obj.nextAction;
  if (typeof obj?.publishTarget === "string") base.publishTarget = obj.publishTarget;
  if (obj?.evidence && typeof obj.evidence === "object") base.evidence = obj.evidence as Record<string, unknown>;
  if (obj?.outcomes && typeof obj.outcomes === "object") base.outcomes = obj.outcomes as Record<string, unknown>;

  return base;
}
