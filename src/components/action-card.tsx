"use client";

import type { PriorityAction, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/project-helpers";
import { toast } from "sonner";
import {
  GitBranch,
  AlertCircle,
  Sparkles,
  Clock,
  XIcon,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

/* ── Source badge colors ────────────────────────────────── */

const SOURCE_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  git: {
    icon: <GitBranch className="size-3" />,
    label: "Git",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  issue: {
    icon: <AlertCircle className="size-3" />,
    label: "GitHub",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  ai: {
    icon: <Sparkles className="size-3" />,
    label: "AI",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  stale: {
    icon: <Clock className="size-3" />,
    label: "Stale",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

const SEVERITY_CONFIG: Record<string, { border: string; dot: string }> = {
  high: {
    border: "border-l-red-500 dark:border-l-red-400",
    dot: "bg-red-500 dark:bg-red-400",
  },
  med: {
    border: "border-l-amber-500 dark:border-l-amber-400",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  low: {
    border: "border-l-muted-foreground/40",
    dot: "bg-muted-foreground/50",
  },
};

interface ActionCardProps {
  action: PriorityAction;
  project?: Project;
  onDismiss?: (action: PriorityAction) => void;
  onSelectProject?: (projectId: string) => void;
}

export function ActionCard({ action, project, onDismiss, onSelectProject }: ActionCardProps) {
  const srcConfig = SOURCE_CONFIG[action.source] ?? SOURCE_CONFIG.git;
  const sevConfig = SEVERITY_CONFIG[action.severity] ?? SEVERITY_CONFIG.low;

  // Build a copy-paste command if we can
  const command = project?.pathDisplay ? `cd "${project.pathDisplay}"` : null;

  return (
    <div
      className={cn(
        "group rounded-xl border border-border border-l-4 bg-card px-4 py-3.5 transition-colors hover:bg-muted/40",
        sevConfig.border,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Severity dot */}
        <div className={cn("mt-1.5 size-2.5 rounded-full shrink-0", sevConfig.dot)} />

        <div className="flex-1 min-w-0">
          {/* Header row: project name + source badge */}
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              className="font-semibold text-sm hover:underline truncate"
              onClick={() => onSelectProject?.(action.projectId)}
              title={`View ${action.projectName}`}
            >
              {action.projectName}
            </button>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0", srcConfig.className)}>
              {srcConfig.icon}
              {srcConfig.label}
            </span>
            {action.type === "git-urgent" && (
              <span className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Urgent</span>
            )}
          </div>

          {/* Action label */}
          <p className="text-sm text-muted-foreground leading-snug">{action.label}</p>

          {/* Command (if available) */}
          {command && (
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded text-foreground/80 truncate max-w-[300px]">
                {command}
              </code>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                onClick={() => {
                  copyToClipboard(command, "Command");
                  toast.success("Command copied");
                }}
              >
                Copy
              </button>
            </div>
          )}

          {/* GitHub issue link for issue actions */}
          {action.source === "issue" && project?.scan?.remoteUrl && action.label.includes("open") && (
            <a
              href={`https://github.com/${extractOwnerRepo(project.scan.remoteUrl)}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink className="size-3" />
              View on GitHub
            </a>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Dismiss this alert"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(action);
            }}
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Action List (all actions) ──────────────────────────── */

interface ActionListProps {
  projects: Project[];
  onDismiss: (action: PriorityAction) => void;
  onSelectProject: (projectId: string) => void;
}

export function ActionList({ projects, onDismiss, onSelectProject }: ActionListProps) {
  // Collect and flatten all actions, sorted by severity
  const allActions = projects.flatMap((p) => (p.actions ?? []).map((a) => ({ ...a })));
  const severityRank: Record<string, number> = { high: 0, med: 1, low: 2 };
  allActions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.type.localeCompare(b.type));

  const highActions = allActions.filter((a) => a.severity === "high");
  const medActions = allActions.filter((a) => a.severity === "med");
  const lowActions = allActions.filter((a) => a.severity === "low");

  // Hide snoozed projects from action list
  const visibleProjects = projects.filter((p) => !p.isSnoozed);
  const projectMap = new Map(visibleProjects.map((p) => [p.id, p]));

  if (allActions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
          <Sparkles className="size-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-medium">All clear!</p>
        <p className="text-xs text-muted-foreground mt-1">No priority actions right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {highActions.length > 0 && (
        <ActionGroup
          title="Needs Attention"
          count={highActions.length}
          actions={highActions}
          projectMap={projectMap}
          onDismiss={onDismiss}
          onSelectProject={onSelectProject}
          defaultOpen
        />
      )}
      {medActions.length > 0 && (
        <ActionGroup
          title="Worth a Look"
          count={medActions.length}
          actions={medActions}
          projectMap={projectMap}
          onDismiss={onDismiss}
          onSelectProject={onSelectProject}
          defaultOpen
        />
      )}
      {lowActions.length > 0 && (
        <ActionGroup
          title="Someday"
          count={lowActions.length}
          actions={lowActions}
          projectMap={projectMap}
          onDismiss={onDismiss}
          onSelectProject={onSelectProject}
          defaultOpen={false}
        />
      )}
    </div>
  );
}

/* ── Action Group (collapsible section) ─────────────────── */

function ActionGroup({
  title,
  count,
  actions,
  projectMap,
  onDismiss,
  onSelectProject,
  defaultOpen,
}: {
  title: string;
  count: number;
  actions: PriorityAction[];
  projectMap: Map<string, Project | undefined>;
  onDismiss: (action: PriorityAction) => void;
  onSelectProject: (projectId: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left group/heading"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {count}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {actions.map((action) => (
            <ActionCard
              key={`${action.projectId}-${action.type}`}
              action={action}
              project={projectMap.get(action.projectId)}
              onDismiss={onDismiss}
              onSelectProject={onSelectProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import React from "react";

function extractOwnerRepo(remoteUrl: string | null | undefined): string {
  if (!remoteUrl) return "";
  const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
  return match?.[1] ?? "";
}