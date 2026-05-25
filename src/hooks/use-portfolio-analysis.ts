import { useCallback, useEffect, useState } from "react";

export interface PortfolioRecommendation {
  projectName: string;
  reasoning: string;
  quickAction: string;
}

export interface PortfolioAnalysis {
  recommendation: PortfolioRecommendation | null;
  secondary: Array<{ projectName: string; reason: string }>;
  portfolioInsights: string[];
  generatedAt: string | null;
}

interface AnalysisResponse {
  ok: boolean;
  recommendation?: PortfolioRecommendation | null;
  secondary?: Array<{ projectName: string; reason: string }>;
  portfolioInsights?: string[];
  generatedAt?: string | null;
  error?: string;
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
        setAnalysis({
          recommendation: data.recommendation ?? null,
          secondary: data.secondary ?? [],
          portfolioInsights: data.portfolioInsights ?? [],
          generatedAt: data.generatedAt ?? null,
        });
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
        setAnalysis({
          recommendation: data.recommendation ?? null,
          secondary: data.secondary ?? [],
          portfolioInsights: data.portfolioInsights ?? [],
          generatedAt: data.generatedAt ?? null,
        });
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