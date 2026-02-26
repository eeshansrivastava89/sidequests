/**
 * LLM provider interface for project enrichment.
 * All providers must return this shape.
 */

export type LlmStatus = "building" | "shipping" | "maintaining" | "blocked" | "completed" | "idea";

export type InsightSeverity = "green" | "amber" | "red";

export interface Insight {
  text: string;
  severity: InsightSeverity;
}

export interface LlmEnrichment {
  summary: string;           // replaces purpose + pitch
  nextAction: string;        // always populated
  status: LlmStatus;         // LLM-assessed project phase
  statusReason: string;      // why this status
  tags: string[];
  insights: Insight[];        // consolidated risks + recommendations with severity
  framework: string | null;        // e.g. "Next.js", "Astro", "FastAPI", "Axum"
  primaryLanguage: string | null;  // e.g. "TypeScript", "Python", "Rust"
}

export interface LlmInput {
  name: string;
  path: string;
  scan: Record<string, unknown>;
  derived: {
    statusAuto: string;
    healthScoreAuto: number;
    hygieneScoreAuto: number;
    momentumScoreAuto: number;
    tags: string[];
  };
  github?: {
    openIssues: number;
    openPrs: number;
    ciStatus: string;
    repoVisibility: string;
    topIssues?: string;
    topPrs?: string;
  };
  previousSummary?: string;
}

export interface LlmProvider {
  name: string;
  enrich(input: LlmInput, signal?: AbortSignal): Promise<LlmEnrichment>;
}
