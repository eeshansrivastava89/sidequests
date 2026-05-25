/**
 * LLM provider interface for project enrichment.
 * All providers must return this shape.
 */

import type { Insight, InsightSeverity } from "@/lib/types";
import type { ScannedProject } from "@/lib/pipeline-native/scan";
export type { Insight, InsightSeverity };

export type LlmStatus = "building" | "shipping" | "maintaining" | "blocked" | "completed" | "idea";

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
  scan: ScannedProject;
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
  /** Run a raw text prompt and return the text response. Used for portfolio-level analysis. */
  analyze(prompt: string, signal?: AbortSignal): Promise<string>;
}
