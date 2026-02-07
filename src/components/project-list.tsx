"use client";

import type { Project } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { toast } from "sonner";
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

function healthColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function formatDaysInactive(days: number | null | undefined): string {
  if (days == null) return "\u2014";
  return `${days}d`;
}

function formatLastTouched(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Opened just now";
  if (mins < 60) return `Opened ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Opened ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Opened ${days}d ago`;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`Copied ${label} command`),
    () => toast.error("Failed to copy")
  );
}

function VsCodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.583 2.213l-4.52 4.275L7.95 2.213 2.4 4.831v14.338l5.55 2.618 5.113-4.275 4.52 4.275L23.6 19.17V4.831l-6.017-2.618zM7.95 15.6l-3.15-2.1V10.5l3.15 2.1v3zm5.113-3.6L7.95 8.4V5.4l5.113 3.6v3zm4.52 3.6l-3.15-2.1v-3l3.15 2.1v3z" />
    </svg>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-3.5 5h7a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5zm1 3.5h5a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5z" />
    </svg>
  );
}

function CodexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h6v2H8v-2z" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function PinIcon({ filled, className }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2L14.5 3.5L18.5 7.5L20 6L16 2ZM12.5 5.5L8 10L9 14L2 21H3L10 14L14 15L18.5 10.5L12.5 5.5Z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76z" />
    </svg>
  );
}

export function ProjectList({ projects, selectedId, onSelect, onTogglePin, onTouch, sanitizePaths }: ProjectListProps) {
  const gridCols = sanitizePaths
    ? "grid-cols-[auto_auto_1fr_auto_3rem_3rem_auto_1fr]"
    : "grid-cols-[auto_auto_1fr_auto_3rem_3rem_auto_1fr_auto]";

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
              {project.scan?.languages?.primary ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                  {project.scan.languages.primary}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">{"\u2014"}</span>
              )}
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
