"use client";

import type { Project } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VsCodeIcon, ClaudeIcon, CodexIcon, TerminalIcon, PinIcon } from "@/components/project-icons";
import { healthColor, copyToClipboard, formatLastTouched } from "@/lib/project-helpers";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (project: Project) => void;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  sanitizePaths: boolean;
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

export function ProjectList({ projects, selectedId, onSelect, onTogglePin, onTouch, sanitizePaths }: ProjectListProps) {
  const gridCols = sanitizePaths
    ? "grid-cols-[0.75rem_1.25rem_1fr_4.5rem_3rem_3rem_7.5rem_1fr]"
    : "grid-cols-[0.75rem_1.25rem_1fr_4.5rem_3rem_3rem_7.5rem_1fr_8.5rem]";

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header row */}
      <div className={cn(
        "grid items-center gap-x-3 px-3 h-8 bg-muted/50 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider select-none",
        gridCols
      )}>
        <div className="w-2.5" />
        <div className="w-5" />
        <div>Name</div>
        <div className="hidden sm:block">Lang</div>
        <div className="hidden md:block text-right">Health</div>
        <div className="hidden sm:block text-right">Inactive</div>
        <div className="hidden lg:block text-right">Opened</div>
        <div className="hidden md:block">Last Commit</div>
        {!sanitizePaths && <div className="text-right">Actions</div>}
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
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-sm truncate" title={rawPath}>
                {project.name}
              </span>
              {project.isDirty && (
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500" title="Uncommitted changes" />
              )}
              {project.ahead > 0 && (
                <span className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono" title={`${project.ahead} ahead of remote`}>↑{project.ahead}</span>
              )}
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

            {/* Health score */}
            <div className={cn(
              "hidden md:block text-right font-mono text-sm font-semibold tabular-nums",
              healthColor(project.healthScore)
            )}>
              {project.healthScore}
            </div>

            {/* Days inactive */}
            <div className="hidden sm:block text-right font-mono text-xs text-muted-foreground tabular-nums">
              {formatDaysInactive(project.scan?.daysInactive)}
            </div>

            {/* Last opened */}
            <div className="hidden lg:block text-right text-[11px] text-muted-foreground truncate">
              {formatLastTouched(project.lastTouchedAt) ?? "\u2014"}
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
                  title="Open in VS Code (v)"
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
                  title="Copy Claude command (c)"
                  onClick={() => { copyToClipboard(`cd "${rawPath}" && claude`, "Claude"); onTouch(project.id, "claude"); }}
                >
                  <ClaudeIcon className="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  title="Copy Codex command (x)"
                  onClick={() => { copyToClipboard(`cd "${rawPath}" && codex`, "Codex"); onTouch(project.id, "codex"); }}
                >
                  <CodexIcon className="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  title="Copy terminal cd command (t)"
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
