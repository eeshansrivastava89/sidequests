"use client";

import type { RefreshState, ProjectProgress } from "@/hooks/use-refresh";
import type { DeltaSummary, ProjectDelta } from "@/hooks/use-refresh-deltas";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RefreshPanelProps {
  state: RefreshState;
  onDismiss: () => void;
  deltaSummary?: DeltaSummary | null;
  projectDeltas?: Map<string, ProjectDelta> | null;
}

function statusIcon(status: string): string {
  switch (status) {
    case "done": return "\u2713";
    case "running": return "\u25CB";
    case "error": return "\u2717";
    case "skipped": return "\u2014";
    default: return " ";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "done": return "text-emerald-600 dark:text-emerald-400";
    case "running": return "text-blue-600 dark:text-blue-400 animate-pulse";
    case "error": return "text-red-600 dark:text-red-400";
    default: return "text-muted-foreground";
  }
}

/** Short human-readable label for the primary delta cause. */
function causeBadge(delta: ProjectDelta): { label: string; className: string } | null {
  const causes = delta.deltaCause;
  if (causes.includes("newly_enriched")) {
    return { label: "enriched", className: "text-violet-600 dark:text-violet-400" };
  }
  if (causes.includes("health_up") || causes.includes("hygiene_up") || causes.includes("momentum_up")) {
    return { label: "score +", className: "text-emerald-600 dark:text-emerald-400" };
  }
  if (causes.includes("health_down") || causes.includes("hygiene_down") || causes.includes("momentum_down")) {
    return { label: "score -", className: "text-amber-600 dark:text-amber-400" };
  }
  if (causes.includes("status_changed")) {
    return { label: "status", className: "text-blue-600 dark:text-blue-400" };
  }
  if (causes.includes("scan_changed")) {
    return { label: "scan", className: "text-muted-foreground" };
  }
  if (causes.includes("unchanged")) {
    return null; // No badge for unchanged
  }
  return null;
}

function ProjectRow({
  project,
  showLlm,
  delta,
}: {
  project: ProjectProgress;
  showLlm: boolean;
  delta?: ProjectDelta;
}) {
  const badge = delta ? causeBadge(delta) : null;

  return (
    <div className="flex items-center gap-3 py-1 text-xs font-mono">
      <span className="w-36 truncate font-medium text-foreground">{project.name}</span>
      <span className={`w-16 ${statusColor(project.storeStatus)}`}>
        {statusIcon(project.storeStatus)} scan
      </span>
      {showLlm && (
        <span className={`w-16 ${statusColor(project.llmStatus)}`}>
          {statusIcon(project.llmStatus)} llm
        </span>
      )}
      {badge && (
        <span className={`w-16 ${badge.className}`}>
          {badge.label}
        </span>
      )}
      {project.llmError && (
        <span className="text-red-500 truncate flex-1" title={project.llmError}>
          {project.llmError}
        </span>
      )}
      {typeof project.detail?.purpose === "string" && !project.llmError && (
        <span className="text-muted-foreground truncate flex-1">
          {project.detail.purpose.slice(0, 60)}
        </span>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function RefreshPanel({ state, onDismiss, deltaSummary, projectDeltas }: RefreshPanelProps) {
  if (!state.active && !state.summary && !state.error) return null;

  const projects = Array.from(state.projects.values());
  const showLlm = state.mode === "enrich";
  const isDone = !state.active;

  // Build a name-keyed lookup for project deltas (delta map is id-keyed,
  // but project progress only has names; lead can provide a name-keyed map
  // or we can skip if not available)
  const deltaByName = projectDeltas
    ? new Map(Array.from(projectDeltas.entries()))
    : null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          {state.active && (
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          )}
          <span className="text-sm font-medium">{state.phase}</span>
          {state.mode && (
            <span className="text-[10px] text-muted-foreground rounded px-1.5 py-0.5 bg-muted">
              {state.mode === "scan" ? "scan only" : "scan + ai"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state.summary && (
            <span className="text-xs text-muted-foreground">
              {formatDuration(state.summary.durationMs!)}
            </span>
          )}
          {isDone && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
              title="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {state.summary && (
        <div className="flex gap-4 px-4 py-2 text-xs border-b border-border bg-muted/30">
          <span>{state.summary.projectCount} scanned</span>
          {showLlm && (state.summary.llmSucceeded! > 0 || state.summary.llmFailed! > 0) && (
            <>
              <span className="text-emerald-600 dark:text-emerald-400">
                {state.summary.llmSucceeded} enriched
              </span>
              {state.summary.llmFailed! > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {state.summary.llmFailed} failed
                </span>
              )}
            </>
          )}
          {showLlm && state.summary.llmSkipped! > 0 && (
            <span className="text-muted-foreground">{state.summary.llmSkipped} skipped</span>
          )}
        </div>
      )}

      {/* Delta cause summary (shown after completion when delta data is available) */}
      {isDone && deltaSummary && (deltaSummary.scoresChanged > 0 || deltaSummary.enriched > 0) && (
        <div className="flex gap-4 px-4 py-1.5 text-xs border-b border-border bg-muted/20">
          {deltaSummary.scoresChanged > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {deltaSummary.scoresChanged} scores changed
            </span>
          )}
          {deltaSummary.enriched > 0 && (
            <span className="text-violet-600 dark:text-violet-400">
              {deltaSummary.enriched} newly enriched
            </span>
          )}
          {deltaSummary.unchanged > 0 && (
            <span className="text-muted-foreground">
              {deltaSummary.unchanged} unchanged
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border-b border-border">
          {state.error}
        </div>
      )}

      {/* Project list */}
      {projects.length > 0 && (
        <ScrollArea className="max-h-64">
          <div className="px-4 py-2 space-y-0">
            {projects.map((p) => (
              <ProjectRow
                key={p.name}
                project={p}
                showLlm={showLlm}
                delta={deltaByName?.get(p.name)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
