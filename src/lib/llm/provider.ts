/**
 * LLM provider interface for project enrichment.
 * All providers must return this shape.
 */

export interface LlmEnrichment {
  purpose: string;
  tags: string[];
  notableFeatures: string[];
  recommendations: string[];
  takeaways?: Record<string, string>;
  // Optional metadata fields (populated when FEATURE_O1=true)
  goal?: string;
  audience?: string;
  successMetrics?: string;
  nextAction?: string;
  publishTarget?: string;
  evidence?: Record<string, unknown>;
  outcomes?: Record<string, unknown>;
}

export interface LlmInput {
  name: string;
  path: string;
  scan: Record<string, unknown>;
  derived: {
    statusAuto: string;
    healthScoreAuto: number;
    tags: string[];
  };
}

export interface LlmProvider {
  name: string;
  enrich(input: LlmInput): Promise<LlmEnrichment>;
}
