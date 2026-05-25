import { useState, useEffect, useCallback } from "react";
import type { Project, PriorityAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CARD, SECTION_LABEL } from "@/lib/status-colors";
import {
  Sparkles,
  Terminal,



  X,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/project-helpers";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────── */

interface PortfolioAnalysis {
  recommendation: {
    projectName: string;
    reasoning: string;
    quickAction: string;
  };
  secondary: Array<{
    projectName: string;
    reason: string;
  }>;
  portfolioInsights: string[];
}

interface WhatNowTabProps {
  projects: Project[];
  onDismiss: (action: PriorityAction) => void;
  onSelectProject: (id: string) => void;
}

/* ── What Now Tab ───────────────────────────────────────── */

export function WhatNowTab({
  projects,
  onDismiss,
  onSelectProject,
}: WhatNowTabProps) {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/analysis");
      const data = await res.json();
      if (data.ok && data.recommendation) {
        setAnalysis(data);
      } else {
        setError(data.error || "Analysis unavailable");
      }
    } catch {
      setError("Failed to get portfolio analysis");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if there are projects with LLM data
    const hasLlm = projects.some((p) => p.nextAction || p.summary);
    if (hasLlm) fetchAnalysis();
  }, [projects, fetchAnalysis]);

  const recommendedProject = analysis
    ? projects.find((p) => p.name === analysis.recommendation.projectName)
    : null;

  const secondaryProjects = analysis
    ? analysis.secondary
        .map((s) => ({
          ...s,
          project: projects.find((p) => p.name === s.projectName),
        }))
        .filter((s) => s.project)
    : [];

  const cdCommand = recommendedProject?.pathDisplay
    ? `cd "${recommendedProject.pathDisplay}"`
    : null;
  return (
    <div className="space-y-6">
      {/* AI Recommendation */}
      {loading && (
        <div className={cn(CARD, "flex items-center gap-3 px-5 py-6")}>
          <Loader2 className="size-5 text-amber-500 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium">Analyzing your portfolio...</p>
            <p className="text-xs text-muted-foreground mt-0.5">Reading across all projects to find the best next step</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className={cn(CARD, "px-5 py-4 border-amber-500/20")}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <span className="text-sm font-medium">AI analysis unavailable</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{error}. Run an AI scan first, or check your LLM provider settings.</p>
          <Button size="sm" variant="outline" onClick={fetchAnalysis} className="gap-1.5 text-xs">
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      )}

      {analysis && !loading && (
        <div className="space-y-4">
          {/* Primary recommendation */}
          <div className={cn(CARD, "overflow-hidden")}>
            <div className="px-5 py-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/10">
                  <Sparkles className="size-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Focus on this</p>
                </div>
              </div>

              {/* Project name */}
              <button
                type="button"
                className="text-lg font-semibold hover:underline decoration-amber-500/40 underline-offset-4"
                onClick={() => recommendedProject && onSelectProject(recommendedProject.id)}
              >
                {analysis.recommendation.projectName}
                <ChevronRight className="inline size-4 text-muted-foreground ml-0.5 -mt-0.5" />
              </button>

              {/* Reasoning */}
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {analysis.recommendation.reasoning}
              </p>

              {/* Quick action pill */}
              <div className="mt-3 flex items-center gap-2">
                <ArrowRight className="size-3.5 text-amber-500 shrink-0" />
                <p className="text-sm font-medium">{analysis.recommendation.quickAction}</p>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                {cdCommand && (
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs bg-foreground text-background hover:bg-foreground/90"
                    onClick={() => {
                      copyToClipboard(cdCommand, "Command");
                      toast.success("Copied");
                    }}
                  >
                    <Terminal className="size-3.5" />
                    Open in terminal
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={fetchAnalysis}
                >
                  <RefreshCw className="size-3.5" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Secondary picks */}
          {secondaryProjects.length > 0 && (
            <div className={cn(CARD)}>
              <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
                <Lightbulb className="size-3.5 text-blue-400" />
                <h3 className={SECTION_LABEL}>Also Worth Attention</h3>
              </div>
              <div className="divide-y divide-border">
                {secondaryProjects.map((s) => {
                  const project = s.project!;
                  return (
                    <button
                      key={s.projectName}
                      type="button"
                      className="w-full text-left px-5 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
                      onClick={() => onSelectProject(project.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.projectName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Portfolio observations */}
          {analysis.portfolioInsights.length > 0 && (
            <div className={cn(CARD)}>
              <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
                <Sparkles className="size-3.5 text-purple-400" />
                <h3 className={SECTION_LABEL}>Portfolio Insights</h3>
              </div>
              <div className="px-5 py-3 space-y-2">
                {analysis.portfolioInsights.map((insight, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                    {insight}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No analysis yet and no loading — prompt to scan */}
      {!analysis && !loading && !error && (
        <div className={cn(CARD, "px-5 py-6 text-center")}>
          <Sparkles className="size-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No AI analysis yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            Run an AI scan to get a personalized portfolio recommendation. The AI analyzes your projects and tells you exactly what to focus on.
          </p>
        </div>
      )}
    </div>
  );
}