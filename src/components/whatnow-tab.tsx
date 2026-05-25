import { useState } from "react";
import type { Project } from "@/lib/types";
import type { PortfolioAnalysis, Urgency } from "@/hooks/use-portfolio-analysis";

import { cn } from "@/lib/utils";
import { STATUS_COLORS_HEX } from "@/lib/status-colors";
import { SectionCard } from "@/components/ui/section-card";
import {
  Sparkles,
  Terminal,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  AlarmClock,
  CheckCircle2,
  GitBranch,
  CircleDot,
  Activity,
  Zap,
  Clock,
  BarChart3,
  ChevronLeft,
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
  onRunScan?: () => void;
}

const PAGE_SIZE = 5;

// ── Urgency config ─────────────────────────────────────────

type UrgencyConfig = { label: string; color: string; bg: string; icon: typeof Zap };

const URGENCY: Record<Urgency, UrgencyConfig> = {
  now: { label: "Do now", color: "text-red-500", bg: "bg-red-500/10", icon: Zap },
  "this-week": { label: "This week", color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
  soon: { label: "Soon", color: "text-blue-400", bg: "bg-blue-500/10", icon: Activity },
};

function UrgencyBadge({ urgency }: { urgency?: Urgency }) {
  if (!urgency) return null;
  const cfg = URGENCY[urgency];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold", cfg.bg, cfg.color)}>
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

// ── Paginated list ─────────────────────────────────────────

function usePagination(total: number) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  return { page, totalPages, canPrev, canNext, start, end, setPage, prev: () => setPage((p) => Math.max(0, p - 1)), next: () => setPage((p) => Math.min(totalPages - 1, p + 1)) };
}

function PageControls({ page, totalPages, canPrev, canNext, onPrev, onNext }: {
  page: number; totalPages: number; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!canPrev}
        onClick={onPrev}
        className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-default transition-colors"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="text-[10px] text-muted-foreground tabular-nums min-w-[32px] text-center">{page + 1}/{totalPages}</span>
      <button
        type="button"
        disabled={!canNext}
        onClick={onNext}
        className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-default transition-colors"
      >
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}

// ── Signal chips ────────────────────────────────────────────

type SignalChip = { label: string; icon: typeof GitBranch; color: string };

function getProjectSignals(p: Project): SignalChip[] {
  const signals: SignalChip[] = [];
  if (p.ciStatus === "failure") signals.push({ label: "CI failing", icon: AlertTriangle, color: "text-red-500" });
  if (p.isDirty) signals.push({ label: p.dirtyFileCount + " uncommitted", icon: GitBranch, color: "text-amber-500" });
  if (p.openIssues > 0) signals.push({ label: p.openIssues + (p.openIssues !== 1 ? " issues" : " issue"), icon: CircleDot, color: "text-amber-500" });
  const daysInactive = p.lastCommitDate ? Math.floor((Date.now() - new Date(p.lastCommitDate).getTime()) / 86400000) : 999;
  if (daysInactive > 14 && p.status !== "archived") signals.push({ label: daysInactive + "d inactive", icon: Activity, color: "text-muted-foreground" });
  return signals;
}

// ── Component ───────────────────────────────────────────────

export function WhatNowTab({
  projects,
  analysis,
  analysisLoading,
  analysisError,
  onSelectProject,
  onSnoozeProject,
  onMarkDone,
  onRunScan,
}: WhatNowTabProps) {
  const upNextPagination = usePagination(analysis?.secondary?.length ?? 0);
  const insightsPagination = usePagination(analysis?.portfolioInsights?.length ?? 0);

  const recommendedProject = analysis?.recommendation
    ? projects.find((p) => p.name === analysis.recommendation!.projectName)
    : null;

  const allSecondaries = analysis?.secondary
    ? analysis.secondary
        .map((s) => ({ ...s, project: projects.find((p) => p.name === s.projectName) }))
        .filter((s) => s.project)
    : [];

  const secondaryProjects = allSecondaries.slice(upNextPagination.start, upNextPagination.end);

  const allInsights = analysis?.portfolioInsights ?? [];
  const visibleInsights = allInsights.slice(insightsPagination.start, insightsPagination.end);

  const urgency = analysis?.recommendation?.urgency;

  return (
    <div className="space-y-4">
      {/* ── Loading ── */}
      {analysisLoading && (
        <SectionCard icon={<div className="size-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />} title="Analyzing your portfolio…">
          <p className="text-sm text-muted-foreground">Reading across all projects to find your best next step.</p>
        </SectionCard>
      )}

      {/* ── Error ── */}
      {analysisError && !analysisLoading && (
        <SectionCard icon={<AlertTriangle className="size-3.5 text-amber-500" />} title="AI analysis unavailable">
          <p className="text-sm text-muted-foreground">{analysisError}. Run an AI scan first, or check your LLM provider settings.</p>
        </SectionCard>
      )}

      {/* ── Empty state ── */}
      {!analysis && !analysisLoading && !analysisError && (
        <SectionCard icon={<Sparkles className="size-3.5 text-muted-foreground" />} title="Get started">
          <div className="text-center py-4">
            <Sparkles className="size-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Run your first AI scan</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
              AI analyzes your projects and tells you exactly what to focus on next.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              You can browse project stats in the Projects tab anytime.
            </p>
            {onRunScan && (
              <Button size="sm" onClick={onRunScan} className="gap-1.5">
                <Sparkles className="size-3.5" />
                Run AI Scan
              </Button>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── Analysis ── */}
      {analysis && !analysisLoading && (
        <div className="space-y-4">
          {/* ── Focus Now ── */}
          {analysis.recommendation && recommendedProject && (() => {
            const cmd = recommendedProject.pathDisplay ? "cd " + recommendedProject.pathDisplay : null;
            const ownerRepo = recommendedProject.scan?.remoteUrl ? parseGitHubOwnerRepo(recommendedProject.scan.remoteUrl) : null;
            const githubUrl = ownerRepo ? "https://github.com/" + ownerRepo.owner + "/" + ownerRepo.repo : null;
            const signals = getProjectSignals(recommendedProject);

            return (
              <SectionCard icon={<Sparkles className="size-3.5 text-amber-500" />} title="Focus now">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_COLORS_HEX[recommendedProject.llmStatus ?? recommendedProject.status] ?? "#9ca3af" }}
                    />
                    <button
                      type="button"
                      className="text-sm font-semibold hover:underline underline-offset-4"
                      onClick={() => onSelectProject(recommendedProject.id)}
                    >
                      {analysis.recommendation!.projectName}
                    </button>
                    <UrgencyBadge urgency={urgency} />
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </div>

                  <div className="flex items-start gap-2">
                    <ArrowRight className="size-3.5 text-foreground shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{analysis.recommendation!.quickAction}</p>
                  </div>

                  {analysis.recommendation!.reasoning && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{analysis.recommendation!.reasoning}</p>
                  )}

                  {signals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {signals.map((s) => {
                        const Icon = s.icon;
                        return (
                          <span key={s.label} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted", s.color)}>
                            <Icon className="size-3" />
                            {s.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {cmd && (
                      <Button size="sm" className="gap-1.5 text-xs bg-foreground text-background hover:bg-foreground/90"
                        onClick={() => { copyToClipboard(cmd, "Command"); toast.success("Copied"); }}>
                        <Terminal className="size-3.5" />
                        Open in terminal
                      </Button>
                    )}
                    {githubUrl && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                        <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" />
                          Open on GitHub
                        </a>
                      </Button>
                    )}
                    {onSnoozeProject && recommendedProject.status !== "archived" && !recommendedProject.isSnoozed && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onSnoozeProject(recommendedProject.id, 7)}>
                        <AlarmClock className="size-3.5" />
                        Snooze 7d
                      </Button>
                    )}
                    {onMarkDone && recommendedProject.status !== "archived" && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onMarkDone(recommendedProject.id)}>
                        <CheckCircle2 className="size-3.5" />
                        Mark done
                      </Button>
                    )}
                  </div>
                </div>
              </SectionCard>
            );
          })()}

          {/* ── Up Next + Insights: 2-column layout ── */}
          {(allSecondaries.length > 0 || allInsights.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ── Up Next ── */}
              {allSecondaries.length > 0 && (
                <SectionCard
                  icon={<BarChart3 className="size-3.5 text-blue-400" />}
                  title="Up next"
                  action={<PageControls {...upNextPagination} onPrev={upNextPagination.prev} onNext={upNextPagination.next} />}
                >
                  <div className="divide-y divide-border -mx-4">
                    {secondaryProjects.map((s) => {
                      const project = s.project!;
                      const statusColor = STATUS_COLORS_HEX[project.llmStatus ?? project.status] ?? "#9ca3af";
                      const signals = getProjectSignals(project);
                      return (
                        <button
                          key={s.projectName}
                          type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-muted/30 transition-colors flex items-center gap-3"
                          onClick={() => onSelectProject(project.id)}
                        >
                          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{s.projectName}</span>
                              <UrgencyBadge urgency={s.urgency} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.reason}</p>
                            {signals.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {signals.slice(0, 2).map((sig) => {
                                  const Icon = sig.icon;
                                  return (
                                    <span key={sig.label} className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", sig.color)}>
                                      <Icon className="size-2.5" />
                                      {sig.label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {/* ── Insights ── */}
              {allInsights.length > 0 && (
                <SectionCard
                  icon={<Sparkles className="size-3.5 text-purple-400" />}
                  title="Insights"
                  action={<PageControls {...insightsPagination} onPrev={insightsPagination.prev} onNext={insightsPagination.next} />}
                >
                  <div className="space-y-2.5">
                    {visibleInsights.map((insight, i) => (
                      <div key={insightsPagination.start + i} className="flex items-start gap-2">
                        <ArrowRight className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}