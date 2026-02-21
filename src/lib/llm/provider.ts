/**
 * LLM provider interface for project enrichment.
 * All providers must return this shape.
 */

export interface AiInsight {
  score: number;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  risks: string[];
  nextBestAction: string;
}

export interface LlmEnrichment {
  purpose: string;
  tags: string[];
  notableFeatures: string[];
  recommendations: string[];
  pitch?: string;
  takeaways?: Record<string, string>;
  // Optional metadata fields
  goal?: string;
  audience?: string;
  successMetrics?: string;
  nextAction?: string;
  publishTarget?: string;
  aiInsight?: AiInsight;
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
