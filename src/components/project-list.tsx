"use client";

import type { Project } from "@/lib/types";
import type { ProjectProgress } from "@/hooks/use-refresh";
import { Badge } from "@/components/ui/badge";
import { PinIcon } from "@/components/project-icons";
import { formatRelativeTime, parseGitHubOwnerRepo } from "@/lib/project-helpers";
import { STATUS_COLORS } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (project: Project) => void;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  sanitizePaths: boolean;
  refreshProgress?: Map<string, ProjectProgress>;
}

const STATUS_DOT = STATUS_COLORS;

function getLangLabel(project: Project): string | null {
  return project.framework ?? project.primaryLanguage ?? null;
}

function getRowShimmerClass(project: Project, refreshProgress?: Map<string, ProjectProgress>): string {
  const prog = refreshProgress?.get(project.name);
  if (!prog) return "";
  if (prog.llmStatus === "running") return "row-enriching";
  if (prog.storeStatus === "running") return "row-scanning";
  // Only show "done" when the LLM step completed (not just store)
  if (prog.llmStatus === "done") return "row-done";
  return "";
}

export function ProjectList({ projects, selectedId, onSelect, onTogglePin, onTouch, sanitizePaths, refreshProgress }: ProjectListProps) {
  const gridCols = "grid-cols-[auto_1fr_5rem_6rem]";

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header row */}
      <div className={cn(
        "grid items-center gap-x-4 px-5 h-10 bg-card border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none",
        gridCols
      )}>
        <div className="w-8" />
        <div>Project</div>
        <div>Last Active</div>
        <div>Lang</div>
      </div>

      {/* Rows */}
      {projects.map((project) => {
        const isSelected = project.id === selectedId;
        const rawPath = project.pathDisplay;
        const hasGitHub = project.repoVisibility !== "not-on-github";
        const ownerRepo = hasGitHub ? parseGitHubOwnerRepo(project.scan?.remoteUrl) : null;
        const shimmerClass = getRowShimmerClass(project, refreshProgress);
        const lastActive = project.lastTouchedAt ?? project.scan?.lastCommitDate ?? "";

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
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                (e.currentTarget.previousElementSibling as HTMLElement)?.focus();
              }
            }}
            className={cn(
              "grid items-start gap-x-4 px-5 py-3 border-b border-border border-l-4 border-l-transparent last:border-b-0 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 outline-none",
              gridCols,
              isSelected
                ? "bg-accent"
                : "hover:bg-muted/50",
              project.status === "archived" && "opacity-50",
              shimmerClass
            )}
          >
            {/* Status dot + pin */}
            <div className="flex items-center gap-2 mt-0.5">
              <div
                className={cn(
                  "w-3 h-3 rounded-full shrink-0",
                  STATUS_DOT[project.status] ?? STATUS_DOT.archived
                )}
                title={project.status}
              />
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
            </div>

            {/* Project name + line 2 */}
            <div className="min-w-0">
              {/* Line 1: name + badges + GitHub link */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base truncate" title={rawPath}>
                  {project.name}
                </span>
                {project.isDirty && (
                  <span className="shrink-0 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded px-1.5 py-0.5 leading-none">uncommitted</span>
                )}
                {project.ahead > 0 && (
                  <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400 font-mono" title={`${project.ahead} ahead of remote`}>↑{project.ahead}</span>
                )}
                {hasGitHub && ownerRepo && (
                  <a
                    href={`https://github.com/${ownerRepo.owner}/${ownerRepo.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="size-3" />
                    GitHub
                  </a>
                )}
              </div>
              {/* Line 2: summary */}
              <div className="mt-1 text-sm text-muted-foreground truncate">
                {project.summary || "\u2014"}
              </div>
            </div>

            {/* Last active */}
            <div className="mt-1 text-xs tabular-nums text-muted-foreground">
              {lastActive ? formatRelativeTime(lastActive) : "\u2014"}
            </div>

            {/* Language badge */}
            <div className="mt-1">
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

          </div>
        );
      })}
    </div>
  );
}
