"use client";

import type { Project } from "@/lib/types";
import type { ProjectProgress } from "@/hooks/use-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VsCodeIcon, ClaudeIcon, CodexIcon, TerminalIcon, PinIcon } from "@/components/project-icons";
import { copyToClipboard } from "@/lib/project-helpers";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (project: Project) => void;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  sanitizePaths: boolean;
  refreshProgress?: Map<string, ProjectProgress>;
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

function CiIndicator({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <span className="text-emerald-500" title="CI passing">&#10003;</span>;
    case "failure":
      return <span className="text-red-500" title="CI failing">&#10007;</span>;
    case "pending":
      return <span className="text-amber-500" title="CI pending">&#9675;</span>;
    default:
      return null;
  }
}

export function ProjectList({ projects, selectedId, onSelect, onTogglePin, onTouch, sanitizePaths, refreshProgress }: ProjectListProps) {
  const gridCols = sanitizePaths
    ? "grid-cols-[0.75rem_1.25rem_1fr_4.5rem]"
    : "grid-cols-[0.75rem_1.25rem_1fr_4.5rem_auto]";

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
        {!sanitizePaths && <div>Actions</div>}
      </div>

      {/* Rows */}
      {projects.map((project) => {
        const isSelected = project.id === selectedId;
        const rawPath = project.pathDisplay;
        const hasGitHub = project.repoVisibility !== "not-on-github";

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
              "grid items-start gap-x-3 px-3 py-2 border-b border-border last:border-b-0 cursor-pointer transition-colors",
              gridCols,
              isSelected
                ? "bg-accent"
                : "hover:bg-muted/50"
            )}
          >
            {/* Status dot / progress indicator */}
            {(() => {
              const prog = refreshProgress?.get(project.name);
              if (prog?.storeStatus === "running") {
                return (
                  <div
                    className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0 mt-1.5"
                    title="Scanning..."
                  />
                );
              }
              if (prog?.llmStatus === "running") {
                return (
                  <div className="shrink-0 mt-1" title="Enriching with AI...">
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="text-amber-500 animate-pulse">
                      <path d="M7 1l1.5 3.5L12 6l-3.5 1.5L7 11 5.5 7.5 2 6l3.5-1.5L7 1z" fill="currentColor" opacity="0.9" />
                    </svg>
                  </div>
                );
              }
              if (prog?.llmStatus === "error") {
                return (
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1.5"
                    title={prog.llmError ?? "LLM error"}
                  />
                );
              }
              return (
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0 mt-1.5",
                    STATUS_DOT[project.status] ?? STATUS_DOT.archived
                  )}
                  title={project.status}
                />
              );
            })()}

            {/* Pin toggle */}
            <button
              type="button"
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded transition-colors mt-0.5",
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

            {/* Name + line 2 */}
            <div className="min-w-0">
              {/* Line 1: name + git badges */}
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
              {/* Line 2: next action + GitHub badges */}
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground min-w-0">
                <span className="truncate">
                  {project.nextAction || "\u2014"}
                </span>
                {hasGitHub && (
                  <>
                    <span className="shrink-0">&middot;</span>
                    <span className="shrink-0" title={`${project.openIssues} open issues`}>
                      {project.openIssues} {project.openIssues === 1 ? "issue" : "issues"}
                    </span>
                    <span className="shrink-0">&middot;</span>
                    <span className="shrink-0" title={`${project.openPrs} open PRs`}>
                      {project.openPrs} {project.openPrs === 1 ? "PR" : "PRs"}
                    </span>
                    {project.ciStatus !== "none" && (
                      <>
                        <span className="shrink-0">&middot;</span>
                        <span className="shrink-0 inline-flex items-center gap-0.5">
                          <CiIndicator status={project.ciStatus} /> CI
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Language badge */}
            <div className="hidden sm:block mt-0.5">
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

            {/* Quick actions */}
            {!sanitizePaths && (
              <div
                className="flex items-center gap-1 mt-0.5"
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
