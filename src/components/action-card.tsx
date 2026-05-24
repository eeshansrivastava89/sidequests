import React from "react";
import type { PriorityAction, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SEVERITY_COLORS, SOURCE_COLORS, SECTION_LABEL } from "@/lib/status-colors";
import { copyToClipboard, parseGitHubOwnerRepo } from "@/lib/project-helpers";
import { toast } from "sonner";
import {
  GitBranch,
  AlertCircle,
  Sparkles,
  Clock,
  XIcon,
  ExternalLink,
} from "lucide-react";

/* ── Source badge config (icon + label only; colors from status-colors) ── */

const SOURCE_ICON: Record<string, { icon: React.ReactNode; label: string }> = {
  git:   { icon: <GitBranch className="size-3" />, label: "Git" },
  issue: { icon: <AlertCircle className="size-3" />, label: "Issue" },
  ai:    { icon: <Sparkles className="size-3" />, label: "AI" },
  stale: { icon: <Clock className="size-3" />, label: "Stale" },
};

/* ── Severity section config ──────────────────────────────── */

const SEVERITY_SECTIONS: Array<{
  key: "high" | "med" | "low";
  label: string;
}> = [
  { key: "high", label: "Needs Attention" },
  { key: "med", label: "Worth a Look" },
  { key: "low", label: "Someday" },
];

/* ── Action Row ─────────────────────────────────────────── */

interface ActionCardProps {
  action: PriorityAction;
  project?: Project;
  onDismiss?: (action: PriorityAction) => void;
  onSelectProject?: (projectId: string) => void;
}

export function ActionCard({ action, project, onDismiss, onSelectProject }: ActionCardProps) {
  const src = SOURCE_ICON[action.source] ?? SOURCE_ICON.git;
  const srcColor = SOURCE_COLORS[action.source] ?? SOURCE_COLORS.git;
  const sev = SEVERITY_COLORS[action.severity] ?? SEVERITY_COLORS.low;
  const command = project?.pathDisplay ? `cd "${project.pathDisplay}"` : null;

  return (
    <div className="group flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
      <span className={cn("size-2 rounded-full shrink-0", sev.dot)} />

      <button
        type="button"
        className="font-medium text-sm hover:underline truncate min-w-0 text-left"
        onClick={() => onSelectProject?.(action.projectId)}
        title={`View ${action.projectName}`}
      >
        {action.projectName}
      </button>

      <span className="text-sm text-muted-foreground truncate min-w-0 flex-1">
        {action.label}
      </span>

      <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium shrink-0", srcColor)}>
        {src.icon}
        {src.label}
      </span>

      {action.type === "git-urgent" && (
        <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide shrink-0">
          Urgent
        </span>
      )}

      {command && (
        <button
          type="button"
          className="shrink-0 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex items-center gap-0.5"
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(command, "Command");
            toast.success("Copied");
          }}
          title={command}
        >
          <span className="truncate max-w-[120px]">{command}</span>
        </button>
      )}

      {action.source === "issue" && project?.scan?.remoteUrl && (() => {
        const ownerRepo = parseGitHubOwnerRepo(project.scan.remoteUrl);
        return ownerRepo ? (
          <a
            href={`https://github.com/${ownerRepo.owner}/${ownerRepo.repo}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
          </a>
        ) : null;
      })()}

      {onDismiss && (
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(action);
          }}
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Action Feed ─────────────────────────────────────────── */

interface ActionFeedProps {
  projects: Project[];
  onDismiss: (action: PriorityAction) => void;
  onSelectProject: (projectId: string) => void;
}

export function ActionFeed({ projects, onDismiss, onSelectProject }: ActionFeedProps) {
  const allActions = projects
    .filter((p) => !p.isSnoozed)
    .flatMap((p) => (p.actions ?? []).map((a) => ({ ...a })));

  const severityRank: Record<string, number> = { high: 0, med: 1, low: 2 };
  allActions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.type.localeCompare(b.type));

  const grouped = SEVERITY_SECTIONS.map(({ key, label }) => ({
    key,
    label,
    actions: allActions.filter((a) => a.severity === key),
  }));

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  if (allActions.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        All clear — no actions right now.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {grouped.map(({ key, label, actions }) =>
        actions.length > 0 ? (
          <div key={key} className="py-2">
            <div className="flex items-center gap-2 px-2 pb-1">
              <span className={cn("size-2 rounded-full", SEVERITY_COLORS[key].dot)} />
              <span className={SECTION_LABEL}>{label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{actions.length}</span>
            </div>
            {actions.map((action, i) => (
              <ActionCard
                key={`${key}-${action.projectId}-${action.type}-${i}`}
                action={action}
                project={projectMap.get(action.projectId)}
                onDismiss={onDismiss}
                onSelectProject={onSelectProject}
              />
            ))}
          </div>
        ) : null
      )}
    </div>
  );
}

/* ── Preserve old exports for compatibility ─────────────── */

export { ActionFeed as ActionList };
export type { ActionCardProps };