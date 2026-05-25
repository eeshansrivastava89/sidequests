import type { Project, PriorityAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CARD, SECTION_LABEL } from "@/lib/status-colors";
import {
  Sparkles,
  GitBranch,
  AlertCircle,
  Clock,
  ExternalLink,
  Terminal,
  Archive,
  AlarmClock,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard, parseGitHubOwnerRepo } from "@/lib/project-helpers";
import { toast } from "sonner";

/* ── Types ──────────────────────────────────────────────── */

interface Recommendation {
  project: Project;
  primary: PriorityAction;
  supporting: PriorityAction[];
  reasoning: string[];
}

interface WhatNowTabProps {
  projects: Project[];
  onDismiss: (action: PriorityAction) => void;
  onSelectProject: (id: string) => void;
  onSnooze: (projectId: string, days: number) => Promise<unknown>;
  onArchive: (projectId: string, note: string | null) => Promise<unknown>;
  onRevive: (projectId: string) => Promise<unknown>;
}

/* ── Recommendation Engine ─────────────────────────────── */

function pickRecommendation(projects: Project[]): Recommendation | null {
  // Filter out snoozed/archived, get their actions
  const eligible = projects.filter((p) => !p.isSnoozed && p.status !== "archived");
  if (eligible.length === 0) return null;

  // Score each project for recommendation priority
  const scored = eligible
    .map((project) => {
      const actions = project.actions ?? [];
      let score = 0;
      let primary: PriorityAction | null = null;
      const supporting: PriorityAction[] = [];
      const reasoning: string[] = [];

      // Pick the highest-severity action as primary
      const sorted = [...actions].sort((a, b) => {
        const sev: Record<string, number> = { high: 0, med: 1, low: 2 };
        return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
      });

      if (sorted.length > 0) primary = sorted[0];

      // Boost for dirty tree (needs attention now)
      if (project.isDirty) {
        score += 20;
        reasoning.push(`${project.dirtyFileCount} uncommitted file${project.dirtyFileCount !== 1 ? "s" : ""}`);
      }

      // Boost for open bugs
      if (project.openIssues > 0) {
        const hasBugs = project.issuesTopJson?.toLowerCase().includes("bug");
        if (hasBugs) {
          score += 15;
          reasoning.push(`has bug reports`);
        } else {
          score += 5;
          reasoning.push(`${project.openIssues} open issue${project.openIssues !== 1 ? "s" : ""}`);
        }
      }

      // Boost for CI failure
      if (project.ciStatus === "failure") {
        score += 15;
        reasoning.push("CI is failing");
      }

      // Boost for stale / high inactivity
      if (project.status === "stale" || project.status === "paused") {
        score += 10;
        reasoning.push(`${project.status === "stale" ? "Stale" : "Paused"} project`);
      }

      // Boost for LLM nextAction (intent signal)
      if (project.nextAction) {
        score += 8;
        reasoning.push(`AI suggests: "${project.nextAction}"`);
      }

      // Boost for recent momentum (projects with recent commits are more relevant)
      if (project.weekCommits > 0) {
        score += 5;
        reasoning.push(`${project.weekCommits} commit${project.weekCommits !== 1 ? "s" : ""} this week`);
      }

      // Collect supporting actions (excluding primary)
      for (const a of sorted.slice(1, 4)) {
        supporting.push(a);
      }

      // If no actions but project is active and has LLM suggestion, still recommend
      if (!primary && project.nextAction) {
        primary = {
          type: "llm-suggestion",
          label: project.nextAction,
          source: "ai",
          severity: "med",
          projectId: project.id,
          projectName: project.name,
        };
      }

      return { project, score, primary, supporting, reasoning };
    })
    .filter((r) => r.primary !== null)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  const best = scored[0];
  return {
    project: best.project,
    primary: best.primary!,
    supporting: best.supporting,
    reasoning: best.reasoning,
  };
}

/* ── Source Icon ────────────────────────────────────────── */

const SOURCE_ICON: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  git: { icon: GitBranch, label: "Git", color: "text-orange-400" },
  issue: { icon: AlertCircle, label: "Issue", color: "text-red-400" },
  ai: { icon: Sparkles, label: "AI", color: "text-purple-400" },
  stale: { icon: Clock, label: "Stale", color: "text-muted-foreground" },
};

/* ── Severity dot color ─────────────────────────────────── */

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  med: "bg-amber-500",
  low: "bg-muted-foreground",
};

/* ── What Now Tab ───────────────────────────────────────── */

export function WhatNowTab({
  projects,
  onDismiss,
  onSelectProject,
  onSnooze,
  onArchive,
  onRevive,
}: WhatNowTabProps) {
  const rec = pickRecommendation(projects);

  // Get projects with actions that aren't the recommendation
  const otherProjectsWithActions = projects
    .filter((p) => !p.isSnoozed && p.status !== "archived")
    .flatMap((p) => (p.actions ?? []).map((a) => ({ ...a })))
    .filter((a) => {
      if (!rec) return true;
      return !(a.projectId === rec.primary.projectId && a.type === rec.primary.type && a.severity === rec.primary.severity);
    });

  const severityRank: Record<string, number> = { high: 0, med: 1, low: 2 };
  otherProjectsWithActions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.type.localeCompare(b.type));

  // Deduplicate: max 1 action per project
  const seenProjects = new Set<string>();
  const otherActions: PriorityAction[] = [];
  for (const a of otherProjectsWithActions) {
    if (!seenProjects.has(a.projectId)) {
      seenProjects.add(a.projectId);
      otherActions.push(a);
    }
  }

  if (!rec && otherActions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="size-10 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold mb-1">All clear</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          No actions right now. Run an AI scan to get personalized recommendations, or check Analytics for portfolio trends.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary recommendation */}
      {rec && (
        <RecommendationCard
          recommendation={rec}
          onDismiss={onDismiss}
          onSelectProject={onSelectProject}
          onSnooze={onSnooze}
          onArchive={onArchive}
        />
      )}

      {/* Other things to look at */}
      {otherActions.length > 0 && (
        <div>
          <h3 className={cn(SECTION_LABEL, "mb-2")}>Also Worth a Look</h3>
          <div className="space-y-1">
            {otherActions.slice(0, 5).map((action) => {
              const src = SOURCE_ICON[action.source] ?? SOURCE_ICON.git;
              const SrcIcon = src.icon;
              const sevDot = SEVERITY_DOT[action.severity] ?? SEVERITY_DOT.low;
              return (
                <div
                  key={`${action.projectId}-${action.type}-${action.severity}`}
                  className="group flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onSelectProject(action.projectId)}
                >
                  <span className={cn("size-2 rounded-full shrink-0", sevDot)} />
                  <span className="text-sm font-medium truncate min-w-0 max-w-[120px]">
                    {action.projectName}
                  </span>
                  <span className="text-sm text-muted-foreground truncate min-w-0 flex-1">
                    {action.label}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium shrink-0", src.color)}>
                    <SrcIcon className="size-3" />
                    {src.label}
                  </span>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Dismiss"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(action);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Recommendation Card ───────────────────────────────── */

function RecommendationCard({
  recommendation,
  onDismiss,
  onSelectProject,
  onSnooze,
  onArchive,
}: {
  recommendation: Recommendation;
  onDismiss: (action: PriorityAction) => void;
  onSelectProject: (id: string) => void;
  onSnooze: (projectId: string, days: number) => Promise<unknown>;
  onArchive: (projectId: string, note: string | null) => Promise<unknown>;
}) {
  const { project, primary, supporting, reasoning } = recommendation;
  const src = SOURCE_ICON[primary.source] ?? SOURCE_ICON.git;
  const SrcIcon = src.icon;
  const sevDot = SEVERITY_DOT[primary.severity] ?? SEVERITY_DOT.low;

  const ownerRepo = project.scan?.remoteUrl ? parseGitHubOwnerRepo(project.scan.remoteUrl) : null;
  const cdCommand = project.pathDisplay ? `cd "${project.pathDisplay}"` : null;

  return (
    <div className={cn(CARD, "overflow-hidden")}>
      {/* Header: project name + source badge */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("size-2.5 rounded-full shrink-0", sevDot)} />
          <button
            type="button"
            className="text-sm font-semibold hover:underline truncate"
            onClick={() => onSelectProject(project.id)}
          >
            {project.name}
          </button>
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium shrink-0", src.color)}>
            <SrcIcon className="size-3" />
            {src.label}
          </span>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
          title="Dismiss"
          onClick={() => onDismiss(primary)}
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Primary recommendation */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-2.5">
          <Sparkles className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium leading-snug">
              {primary.label}
            </p>
            {project.nextAction && primary.type !== "llm-suggestion" && (
              <p className="text-sm text-muted-foreground mt-1">
                AI suggestion: {project.nextAction}
              </p>
            )}
          </div>
        </div>

        {/* Reasoning */}
        {reasoning.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {reasoning.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted px-2 py-0.5 rounded-md"
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {cdCommand && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => {
                copyToClipboard(cdCommand, "Command");
                toast.success("Copied");
              }}
            >
              <Terminal className="size-3.5" />
              Copy path
            </Button>
          )}
          {ownerRepo && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => window.open(`https://github.com/${ownerRepo.owner}/${ownerRepo.repo}/issues`, "_blank")}
            >
              <ExternalLink className="size-3.5" />
              GitHub
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => onSnooze(project.id, 7)}
          >
            <AlarmClock className="size-3.5" />
            Snooze 7d
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => onArchive(project.id, null)}
          >
            <Archive className="size-3.5" />
            Archive
          </Button>
        </div>
      </div>

      {/* Supporting signals */}
      {supporting.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border bg-muted/30">
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Also flagged</p>
          <div className="flex flex-wrap gap-1.5">
            {supporting.map((s, i) => {
              const sSrc = SOURCE_ICON[s.source] ?? SOURCE_ICON.git;
              const SIcon = sSrc.icon;
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md"
                >
                  <SIcon className="size-3" />
                  {s.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}