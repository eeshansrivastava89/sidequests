/**
 * LLM provider interface for project enrichment.
 * All providers must return this shape.
 */

export type LlmStatus = "building" | "shipping" | "maintaining" | "blocked" | "stale" | "idea";

export interface LlmEnrichment {
  summary: string;           // replaces purpose + pitch
  nextAction: string;        // always populated
  status: LlmStatus;         // LLM-assessed project phase
  statusReason: string;      // why this status
  risks: string[];           // flat array
  tags: string[];
  recommendations: string[];
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
  enrich(input: LlmInput): Promise<LlmEnrichment>;
}
