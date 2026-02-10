"use client";

import type { Project } from "@/lib/types";
import type { DashboardDeltas } from "@/hooks/use-refresh-deltas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VsCodeIcon, ClaudeIcon, CodexIcon, TerminalIcon, PinIcon } from "@/components/project-icons";
import { healthColor, copyToClipboard } from "@/lib/project-helpers";
import { evaluateAttention } from "@/lib/attention";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (project: Project) => void;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  sanitizePaths: boolean;
  deltas?: DashboardDeltas | null;
  view?: string;
}

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  paused: "bg-blue-500",
  stale: "bg-amber-500",
  archived: "bg-zinc-400",
};

const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs: "Next.js",
  express: "Express",
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  react: "React",
  vue: "Vue",
  axum: "Axum",
  actix: "Actix",
};

function getLangLabel(project: Project): string | null {
  const raw =
    project.framework ??
    project.scan?.languages?.primary ??
    project.packageManager ??
    project.scan?.languages?.detected?.[0] ??
    null;
  if (!raw) return null;
  return FRAMEWORK_LABELS[raw.toLowerCase()] ?? raw;
}

function formatDaysInactive(days: number | null | undefined): string {
  if (days == null) return "\u2014";
  return `${days}d`;
}

export function ProjectList({ projects, selectedId, onSelect, onTogglePin, onTouch, sanitizePaths, deltas, view }: ProjectListProps) {
  const gridCols = sanitizePaths
    ? "grid-cols-[0.75rem_1.25rem_1fr_4.5rem_4rem_5rem_3rem_5.5rem_1fr]"
    : "grid-cols-[0.75rem_1.25rem_1fr_4.5rem_4rem_5rem_3rem_5.5rem_1fr_7rem]";

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header row */}
      <div className={cn(
        "grid items-center gap-x-3 px-3 h-8 bg-muted/50 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider select-none",
        gridCols
      )}>
        <div className="w-2.5" title="Status: green=active, blue=paused, amber=stale, gray=archived" />
        <div className="w-5" />
        <div>Name</div>
        <div className="hidden sm:block">Lang</div>
        <div className="hidden md:block text-right" title="Structural: README, tests, CI, linter, license, lockfile, deploy, remote">Hygiene</div>
        <div className="hidden md:block text-right" title="Operational: commit recency, uncommitted changes, ahead/behind, stale branches">Momentum</div>
        <div className="hidden sm:block text-right">Inactive</div>
        <div className="hidden lg:block text-right">LOC</div>
        <div className="hidden md:block">Last Commit</div>
        {!sanitizePaths && <div>Actions</div>}
      </div>

      {/* Rows */}
      {projects.map((project) => {
        const isSelected = project.id === selectedId;
        const rawPath = project.pathDisplay;

        return (
          <div
            key={project.id}
            data-project-id={project.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(project)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(project);
              }
            }}
            className={cn(
              "grid items-center gap-x-3 px-3 h-10 border-b border-border last:border-b-0 cursor-pointer transition-colors",
              gridCols,
              isSelected
                ? "bg-accent"
                : "hover:bg-muted/50"
            )}
          >
            {/* Status dot */}
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full shrink-0",
                STATUS_DOT[project.status] ?? STATUS_DOT.archived
              )}
              title={project.status}
            />

            {/* Pin toggle */}
            <button
              type="button"
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded transition-colors",
                project.pinned
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-muted-foreground/30 hover:text-muted-foreground/60"
              )}
              title={project.pinned ? "Unpin project" : "Pin project"}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(project.id);
              }}
            >
              <PinIcon filled={project.pinned} className="size-3.5" />
            </button>

            {/* Name + git indicators */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate" title={rawPath}>
                  {project.name}
                </span>
                {project.isDirty && (
                  <span className="shrink-0 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded px-1 py-0.5 leading-none">uncommitted</span>
                )}
                {project.ahead > 0 && (
                  <span className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono" title={`${project.ahead} ahead of remote`}>↑{project.ahead}</span>
                )}
              </div>
              {view === "needs-attention" && (() => {
                const attention = evaluateAttention(project);
                if (!attention.needsAttention) return null;
                return (
                  <div className="flex items-center gap-1 mt-0.5">
                    {attention.reasons.slice(0, 2).map(r => (
                      <span key={r.code} className={cn(
                        "text-[9px] rounded px-1 py-0",
                        r.severity === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        r.severity === "med" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      )}>
                        {r.label}
                      </span>
                    ))}
                    {attention.reasons.length > 2 && (
                      <span className="text-[9px] text-muted-foreground">+{attention.reasons.length - 2}</span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Language badge */}
            <div className="hidden sm:block">
              {(() => {
                const label = getLangLabel(project);
                return label ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    {label}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">{"\u2014"}</span>
                );
              })()}
            </div>

            {/* Hygiene */}
            <div className="hidden md:block text-right font-mono text-xs tabular-nums">
              <span className={cn("font-semibold", healthColor(project.hygieneScore))}>
                {project.hygieneScore}
              </span>
              {(() => {
                const d = deltas?.projects.get(project.id);
                if (!d || d.hygieneScore === 0) return null;
                return (
                  <span className={`ml-1 text-[10px] ${d.hygieneScore > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {d.hygieneScore > 0 ? `+${d.hygieneScore}` : d.hygieneScore}
                  </span>
                );
              })()}
            </div>

            {/* Momentum */}
            <div className="hidden md:block text-right font-mono text-xs tabular-nums">
              <span className={cn("font-semibold", healthColor(project.momentumScore))}>
                {project.momentumScore}
              </span>
              {(() => {
                const d = deltas?.projects.get(project.id);
                if (!d || d.momentumScore === 0) return null;
                return (
                  <span className={`ml-1 text-[10px] ${d.momentumScore > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {d.momentumScore > 0 ? `+${d.momentumScore}` : d.momentumScore}
                  </span>
                );
              })()}
            </div>

            {/* Days inactive */}
            <div className="hidden sm:block text-right font-mono text-xs text-muted-foreground tabular-nums">
              {formatDaysInactive(project.scan?.daysInactive)}
            </div>

            {/* LOC */}
            <div className="hidden lg:block text-right font-mono text-xs text-muted-foreground tabular-nums">
              {project.locEstimate ? project.locEstimate.toLocaleString() : "\u2014"}
              {(() => {
                const d = deltas?.projects.get(project.id);
                if (!d || d.locEstimate === 0) return null;
                return (
                  <span className={`ml-1 text-[10px] ${d.locEstimate > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {d.locEstimate > 0 ? `+${d.locEstimate.toLocaleString()}` : d.locEstimate.toLocaleString()}
                  </span>
                );
              })()}
            </div>

            {/* Last commit message */}
            <div className="hidden md:block font-mono text-xs text-muted-foreground truncate min-w-0">
              {project.scan?.lastCommitMessage ?? "\u2014"}
            </div>

            {/* Quick actions */}
            {!sanitizePaths && (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-[#007ACC] hover:bg-[#007ACC]/10"
                  title="Open in VS Code"
                  asChild
                >
                  <a href={`vscode://file${encodeURI(rawPath)}`} onClick={() => onTouch(project.id, "vscode")}>
                    <VsCodeIcon className="size-4" />
                  </a>
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-[#D97757] hover:bg-[#D97757]/10"
                  title="Copy Claude command"
                  onClick={() => { copyToClipboard(`cd "${rawPath}" && claude`, "Claude"); onTouch(project.id, "claude"); }}
                >
                  <ClaudeIcon className="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  title="Copy Codex command"
                  onClick={() => { copyToClipboard(`cd "${rawPath}" && codex`, "Codex"); onTouch(project.id, "codex"); }}
                >
                  <CodexIcon className="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  title="Copy terminal cd command"
                  onClick={() => { copyToClipboard(`cd "${rawPath}"`, "Terminal"); onTouch(project.id, "terminal"); }}
                >
                  <TerminalIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
