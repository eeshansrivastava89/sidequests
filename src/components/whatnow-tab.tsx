import type { Project } from "@/lib/types";
import type { PortfolioAnalysis, Urgency } from "@/hooks/use-portfolio-analysis";

import { cn } from "@/lib/utils";
import { CARD, SECTION_LABEL } from "@/lib/status-colors";
import {
  Sparkles,
  Terminal,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  ExternalLink,
  AlarmClock,
  CheckCircle2,
  GitBranch,
  CircleDot,
  Activity,
  Zap,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard, parseGitHubOwnerRepo } from "@/lib/project-helpers";
import { toast } from "sonner";

interface WhatNowTabProps {
  projects: Project[];
  analysis: PortfolioAnalysis | null;
  analysisLoading: boolean;
  analysisError: string | null;
  onSelectProject: (id: string) => void;
  onSnoozeProject?: (id: string, days: number) => void;
  onMarkDone?: (id: string) => void;
}

type SignalChip = {
  label: string;
  icon: typeof GitBranch;
  color: string;
};

const URGENCY_STYLES: Record<Urgency, { border: string; glow: string; badge: string; icon: typeof Zap }> = {
  now: {
    border: "border-red-500/40",
    glow: "shadow-[0_0_24px_-4px_rgba(239,68,68,0.15)]",
    badge: "bg-red-500/10 text-red-500",
    icon: Zap,
  },
  "this-week": {
    border: "border-amber-500/40",
    glow: "shadow-[0_0_24px_-4px_rgba(245,158,11,0.12)]",
    badge: "bg-amber-500/10 text-amber-500",
    icon: Clock,
  },
  soon: {
    border: "border-blue-500/20",
    glow: "",
    badge: "bg-blue-500/10 text-blue-400",
    icon: Activity,
  },
};

function getProjectSignals(p: Project): SignalChip[] {
  const signals: SignalChip[] = [];

  if (p.ciStatus === "failure") {
    signals.push({ label: "CI failing", icon: AlertTriangle, color: "bg-red-500/10 text-red-500" });
  }
  if (p.isDirty) {
    signals.push({ label: p.dirtyFileCount + " uncommitted", icon: GitBranch, color: "bg-amber-500/10 text-amber-500" });
  }
  if (p.openIssues > 0) {
    signals.push({ label: p.openIssues + (p.openIssues !== 1 ? " issues" : " issue"), icon: CircleDot, color: "bg-amber-500/10 text-amber-500" });
  }

  const daysInactive = p.lastCommitDate
    ? Math.floor((Date.now() - new Date(p.lastCommitDate).getTime()) / 86400000)
    : 999;
  if (daysInactive > 14 && p.status !== "archived") {
    signals.push({ label: daysInactive + "d inactive", icon: Activity, color: "bg-muted text-muted-foreground" });
  }

  return signals;
}

function UrgencyBadge({ urgency }: { urgency?: Urgency }) {
  if (!urgency) return null;
  const style = URGENCY_STYLES[urgency];
  const Icon = style.icon;
  const labels: Record<Urgency, string> = { now: "Do now", "this-week": "This week", soon: "Soon" };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold", style.badge)}>
      <Icon className="size-3" />
      {labels[urgency]}
    </span>
  );
}



export function WhatNowTab({
  projects,
  analysis,
  analysisLoading,
  analysisError,
  onSelectProject,
  onSnoozeProject,
  onMarkDone,
}: WhatNowTabProps) {
  const recommendedProject = analysis?.recommendation
    ? projects.find((p) => p.name === analysis.recommendation!.projectName)
    : null;

  const secondaryProjects = analysis?.secondary
    ? analysis.secondary
        .map((s) => ({
          ...s,
          project: projects.find((p) => p.name === s.projectName),
        }))
        .filter((s) => s.project)
    : [];

  const cdCommand = recommendedProject?.pathDisplay ? "cd " + recommendedProject.pathDisplay : null;
  const signals = recommendedProject ? getProjectSignals(recommendedProject) : [];
  const ownerRepo = recommendedProject?.scan?.remoteUrl
    ? parseGitHubOwnerRepo(recommendedProject.scan.remoteUrl)
    : null;
  const githubUrl = ownerRepo ? "https://github.com/" + ownerRepo.owner + "/" + ownerRepo.repo : null;

  const urgency = analysis?.recommendation?.urgency;
  const urgencyStyle = urgency ? URGENCY_STYLES[urgency] : null;

  return (
    <div className="space-y-5">
      {analysisLoading && (
        <div className={cn(CARD, "flex items-center gap-3 px-5 py-6")}>
          <div className="size-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium">Analyzing your portfolio...</p>
            <p className="text-xs text-muted-foreground mt-0.5">Reading across all projects to find the best next step</p>
          </div>
        </div>
      )}

      {analysisError && !analysisLoading && (
        <div className={cn(CARD, "px-5 py-4 border-amber-500/20")}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <span className="text-sm font-medium">AI analysis unavailable</span>
          </div>
          <p className="text-xs text-muted-foreground">{analysisError}. Run an AI scan first, or check your LLM provider settings.</p>
        </div>
      )}

      {analysis && !analysisLoading && (
        <div className="space-y-4">
          {analysis.recommendation && (
            <div className={cn(CARD, "overflow-hidden", urgencyStyle?.border, urgencyStyle?.glow)}>
              <div className="px-5 py-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/10">
                    <Sparkles className="size-4 text-amber-500" />
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Focus on this</p>
                  <UrgencyBadge urgency={urgency} />
                </div>

                <button
                  type="button"
                  className="text-lg font-semibold hover:underline decoration-amber-500/40 underline-offset-4"
                  onClick={() => recommendedProject && onSelectProject(recommendedProject.id)}
                >
                  {analysis.recommendation.projectName}
                  <ChevronRight className="inline size-4 text-muted-foreground ml-0.5 -mt-0.5" />
                </button>

                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {analysis.recommendation.reasoning}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <ArrowRight className="size-3.5 text-amber-500 shrink-0" />
                  <p className="text-sm font-medium">{analysis.recommendation.quickAction}</p>
                </div>

                {signals.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {signals.map((s) => {
                      const Icon = s.icon;
                      return (
                        <span
                          key={s.label}
                          className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium", s.color)}
                        >
                          <Icon className="size-3" />
                          {s.label}
                        </span>
                      );
                    })}
                  </div>
                )}

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
                  {githubUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      asChild
                    >
                      <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" />
                        Open on GitHub
                      </a>
                    </Button>
                  )}
                  {onSnoozeProject && recommendedProject && recommendedProject.status !== "archived" && !recommendedProject.isSnoozed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => onSnoozeProject(recommendedProject.id, 7)}
                    >
                      <AlarmClock className="size-3.5" />
                      Snooze 7d
                    </Button>
                  )}
                  {onMarkDone && recommendedProject && recommendedProject.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => onMarkDone(recommendedProject.id)}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Mark done
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {secondaryProjects.length > 0 && (
            <div className={cn(CARD)}>
              <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
                <Lightbulb className="size-3.5 text-blue-400" />
                <h3 className={SECTION_LABEL}>Also Worth Attention</h3>
              </div>
              <div className="divide-y divide-border">
                {secondaryProjects.map((s) => {
                  const project = s.project!;
                  const secSignals = getProjectSignals(project);
                  return (
                    <button
                      key={s.projectName}
                      type="button"
                      className="w-full text-left px-5 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
                      onClick={() => onSelectProject(project.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{s.projectName}</p>
                          <UrgencyBadge urgency={s.urgency} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                        {secSignals.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {secSignals.slice(0, 3).map((sig) => {
                              const Icon = sig.icon;
                              return (
                                <span
                                  key={sig.label}
                                  className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", sig.color.split(" ").slice(1).join(" "))}
                                >
                                  <Icon className="size-2.5" />
                                  {sig.label}
                                </span>
                              );
                            })}
                            {secSignals.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{secSignals.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          {Object.keys(analysis.extras).length > 0 && (
            <div className={cn(CARD)}>
              <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
                <Lightbulb className="size-3.5 text-muted-foreground" />
                <h3 className={SECTION_LABEL}>More from AI</h3>
              </div>
              <div className="px-5 py-3 space-y-2">
                {Object.entries(analysis.extras).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{key}</span>
                    <p className="text-sm text-muted-foreground mt-0.5">{typeof value === "string" ? value : JSON.stringify(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!analysis && !analysisLoading && !analysisError && (
        <div className={cn(CARD, "px-5 py-6 text-center")}>
          <Sparkles className="size-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No AI analysis yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Run an AI scan to get a personalized portfolio recommendation. The AI analyzes your projects and tells you exactly what to focus on.
          </p>
        </div>
      )}
    </div>
  );
}