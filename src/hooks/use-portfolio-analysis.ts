import { useCallback, useEffect, useState } from "react";

export type Urgency = "now" | "this-week" | "soon";

export interface PortfolioRecommendation {
  projectName: string;
  reasoning: string;
  quickAction: string;
  urgency?: Urgency;
}

export interface PortfolioSecondaryPick {
  projectName: string;
  reason: string;
  urgency?: Urgency;
}

export interface PortfolioAnalysis {
  recommendation: PortfolioRecommendation | null;
  secondary: PortfolioSecondaryPick[];
  portfolioInsights: string[];
  generatedAt: string | null;
  extras: Record<string, unknown>;
}

interface AnalysisResponse {
  ok: boolean;
  recommendation?: PortfolioRecommendation | null;
  secondary?: PortfolioSecondaryPick[];
  portfolioInsights?: string[];
  generatedAt?: string | null;
  error?: string;
  [key: string]: unknown;
}

const KNOWN_KEYS = new Set(["ok", "recommendation", "secondary", "portfolioInsights", "generatedAt", "error", "cached"]);

function parseAnalysis(data: AnalysisResponse): PortfolioAnalysis {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!KNOWN_KEYS.has(key)) extras[key] = value;
  }
  return {
    recommendation: data.recommendation ?? null,
    secondary: data.secondary ?? [],
    portfolioInsights: data.portfolioInsights ?? [],
    generatedAt: data.generatedAt ?? null,
    extras,
  };
}

export function usePortfolioAnalysis() {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/analysis");
      const data: AnalysisResponse = await res.json();
      if (data.ok) {
        setAnalysis(parseAnalysis(data));
      } else {
        setError(data.error || "Analysis unavailable");
      }
    } catch {
      setError("Failed to load portfolio analysis");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once on mount — data is persisted in DB, no hidden re-runs
  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const refreshAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/analysis", { method: "POST" });
      const data: AnalysisResponse = await res.json();
      if (data.ok) {
        setAnalysis(parseAnalysis(data));
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch {
      setError("Failed to refresh portfolio analysis");
    } finally {
      setLoading(false);
    }
  }, []);

  return { analysis, loading, error, fetchAnalysis, refreshAnalysis };
}