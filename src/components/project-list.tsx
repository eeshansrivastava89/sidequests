"use client";

import type { Project } from "@/lib/types";
import type { ProjectProgress } from "@/hooks/use-refresh";
import { Button } from "@/components/ui/button";
import { VsCodeIcon, ClaudeIcon, TerminalIcon, PinIcon } from "@/components/project-icons";
import { copyToClipboard, formatRelativeTime, parseGitHubOwnerRepo } from "@/lib/project-helpers";
import { STATUS_COLORS } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { Check, X as XIcon, Circle, Lock, Globe, Minus, AlertCircle, Zap, Sparkles } from "lucide-react";

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (project: Project) => void;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  refreshProgress?: Map<string, ProjectProgress>;
}

const STATUS_DOT = STATUS_COLORS;

function CiIcon({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <Check className="size-4 text-emerald-500" />;
    case "failure":
      return <XIcon className="size-4 text-red-500" />;
    case "pending":
      return <Circle className="size-4 text-amber-500 fill-amber-500" />;
    default:
      return <Minus className="size-4 text-muted-foreground" />;
  }
}

function VisibilityIcon({ visibility }: { visibility: string }) {
  switch (visibility) {
    case "private":
      return <Lock className="size-4 text-amber-500" />;
    case "public":
      return <Globe className="size-4 text-emerald-500" />;
    default:
      return <Minus className="size-4 text-muted-foreground" />;
  }
}

function getRowShimmerClass(project: Project, refreshProgress?: Map<string, ProjectProgress>): string {
  const prog = refreshProgress?.get(project.name);
  if (!prog) return "";
  if (prog.llmStatus === "running") return "row-enriching";
  if (prog.storeStatus === "running") return "row-scanning";
  if (prog.llmStatus === "error") return "row-error";
  // Only show "done" when the LLM step completed (not just store)
  if (prog.llmStatus === "done") return "row-done";
  return "";
}

export function ProjectList({ projects, selectedId, onSelect, onTogglePin, onTouch, refreshProgress }: ProjectListProps) {
  // Project ~60% (6fr), right columns ~40% total
  const gridCols = "grid-cols-[auto_6fr_5rem_3.5rem_3.5rem_2.5rem_3rem_5.5rem]";

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header row */}
      <div className={cn(
        "grid items-center gap-x-4 px-5 h-10 bg-card border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none",
        gridCols
      )}>
        <div className="w-8" />
        <div>Project</div>
        <div className="text-right">Last Active</div>
        <div className="text-center">Issues</div>
        <div className="text-center">PRs</div>
        <div className="text-center">CI</div>
        <div className="text-center">Visibility</div>
        <div className="text-center">Actions</div>
      </div>

      {/* Rows */}
      {projects.map((project) => {
        const isSelected = project.id === selectedId;
        const rawPath = project.pathDisplay;
        const hasGitHub = project.repoVisibility !== "not-on-github";
        const ownerRepo = hasGitHub ? parseGitHubOwnerRepo(project.scan?.remoteUrl) : null;
        const prog = refreshProgress?.get(project.name);
        const shimmerClass = getRowShimmerClass(project, refreshProgress);
        const lastActive = project.lastTouchedAt ?? project.scan?.lastCommitDate ?? "";
        const scanDelay = shimmerClass === "row-scan-complete" && prog?.storeOrder != null
          ? { animationDelay: `${prog.storeOrder * 150}ms`, animationFillMode: "backwards" as const }
          : undefined;

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
            style={scanDelay}
            className={cn(
              "grid items-center gap-x-4 px-5 py-3 border-b border-border border-l-4 border-l-transparent last:border-b-0 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 outline-none",
              gridCols,
              isSelected
                ? "bg-accent"
                : "hover:bg-muted/50",
              project.status === "archived" && "opacity-50",
              shimmerClass
            )}
          >
            {/* Status dot + pin */}
            <div className="flex items-center gap-2">
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
              {/* Line 1: name + badges */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base truncate" title={rawPath}>
                  {project.name}
                </span>
                {project.isDirty && (
                  <span className="shrink-0 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded px-1.5 py-0.5 leading-none">
                    uncommitted{project.dirtyFileCount > 0 ? ` (${project.dirtyFileCount})` : ""}
                  </span>
                )}
                {project.lastScanned && (
                  <span
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded px-1.5 py-0.5 leading-none"
                    title={`Scanned ${new Date(project.lastScanned).toLocaleString()}`}
                  >
                    <Zap className="size-3" />
                    Scanned {formatRelativeTime(project.lastScanned)}
                  </span>
                )}
                {project.llmError ? (
                  <span
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded px-1.5 py-0.5 leading-none"
                    title={project.llmError}
                  >
                    <AlertCircle className="size-3" />
                    AI scan failed
                  </span>
                ) : project.llmGeneratedAt ? (
                  <span
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded px-1.5 py-0.5 leading-none"
                    title={`AI scanned ${new Date(project.llmGeneratedAt).toLocaleString()}`}
                  >
                    <Sparkles className="size-3" />
                    AI scanned {formatRelativeTime(project.llmGeneratedAt)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5 leading-none">
                    No AI scan
                  </span>
                )}
              </div>
              {/* Line 2: summary */}
              <div className="mt-1 text-sm text-muted-foreground truncate">
                {project.summary || "\u2014"}
              </div>
            </div>

            {/* Last active */}
            <div className="text-right text-xs tabular-nums text-muted-foreground whitespace-nowrap">
              {lastActive ? formatRelativeTime(lastActive) : "\u2014"}
            </div>

            {/* Issues */}
            <div className="text-center">
              {hasGitHub ? (
                ownerRepo ? (
                  <a
                    href={`https://github.com/${ownerRepo.owner}/${ownerRepo.repo}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm tabular-nums text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {project.openIssues}
                  </a>
                ) : (
                  <span className="text-sm tabular-nums text-muted-foreground">{project.openIssues}</span>
                )
              ) : (
                <span className="text-muted-foreground text-sm">{"\u2014"}</span>
              )}
            </div>

            {/* PRs */}
            <div className="text-center">
              {hasGitHub ? (
                ownerRepo ? (
                  <a
                    href={`https://github.com/${ownerRepo.owner}/${ownerRepo.repo}/pulls`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm tabular-nums text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {project.openPrs}
                  </a>
                ) : (
                  <span className="text-sm tabular-nums text-muted-foreground">{project.openPrs}</span>
                )
              ) : (
                <span className="text-muted-foreground text-sm">{"\u2014"}</span>
              )}
            </div>

            {/* CI Status */}
            <div className="flex justify-center">
              {hasGitHub ? (
                ownerRepo ? (
                  <a
                    href={`https://github.com/${ownerRepo.owner}/${ownerRepo.repo}/actions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70"
                    onClick={(e) => e.stopPropagation()}
                    title={project.ciStatus || "No CI"}
                  >
                    <CiIcon status={project.ciStatus} />
                  </a>
                ) : (
                  <CiIcon status={project.ciStatus} />
                )
              ) : (
                <Minus className="size-4 text-muted-foreground" />
              )}
            </div>

            {/* Visibility */}
            <div className="flex justify-center" title={project.repoVisibility}>
              <VisibilityIcon visibility={project.repoVisibility} />
            </div>

            {/* Actions */}
            <div className="flex justify-center">
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                  title="Copy terminal cd command"
                  onClick={() => { copyToClipboard(`cd "${rawPath}"`, "Terminal"); onTouch(project.id, "terminal"); }}
                >
                  <TerminalIcon className="size-4" />
                </Button>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}
