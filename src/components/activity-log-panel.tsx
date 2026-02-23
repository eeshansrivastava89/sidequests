"use client";

import { useEffect, useRef, useState } from "react";
import type { RefreshState, ProjectProgress } from "@/hooks/use-refresh";
import type { AppConfig } from "@/hooks/use-config";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Activity, ChevronDown, Check, XCircle, Clock, Sparkles, Loader2 } from "lucide-react";

type ProjectStatus = "pending" | "scanning" | "ai-scanning" | "done" | "error" | "skipped";

/**
 * Derive display status for a project in the activity log.
 * `refreshDone` indicates the entire refresh has completed — if store finished
 * but LLM never ran, that means it was a fast-scan-only run.
 */
function deriveStatus(prog: ProjectProgress | undefined, refreshDone: boolean): ProjectStatus {
  if (!prog) return "pending";
  if (prog.llmStatus === "done") return "done";
  if (prog.llmStatus === "error") return "error";
  if (prog.llmStatus === "skipped") return "skipped";
  if (prog.llmStatus === "running") return "ai-scanning";
  if (prog.storeStatus === "running") return "scanning";
  // Store finished, LLM still pending — either waiting for AI or fast-scan-only
  if (prog.storeStatus === "done" && refreshDone) return "done";
  if (prog.storeStatus === "done") return "pending";
  return "pending";
}

function StatusIcon({ status }: { status: ProjectStatus }) {
  switch (status) {
    case "pending":
      return <Clock className="size-3.5 text-muted-foreground" />;
    case "scanning":
      return <Loader2 className="size-3.5 text-blue-400 animate-spin" />;
    case "ai-scanning":
      return <Sparkles className="size-3.5 text-purple-400 animate-pulse" />;
    case "done":
      return <Check className="size-3.5 text-emerald-400" />;
    case "error":
      return <XCircle className="size-3.5 text-red-400" />;
    case "skipped":
      return <Check className="size-3.5 text-muted-foreground" />;
  }
}

function statusLabel(status: ProjectStatus): string {
  switch (status) {
    case "pending": return "Waiting";
    case "scanning": return "Scanning";
    case "ai-scanning": return "AI scanning";
    case "done": return "Done";
    case "error": return "Failed";
    case "skipped": return "Skipped";
  }
}

function getProviderLabel(config: AppConfig): string {
  const p = config.llmProvider;
  switch (p) {
    case "claude-cli": return `Claude CLI${config.claudeCliModel ? ` \u00b7 ${config.claudeCliModel}` : ""}`;
    case "codex-cli": return `Codex CLI${config.codexCliModel ? ` \u00b7 ${config.codexCliModel}` : ""}`;
    case "openrouter": return `OpenRouter${config.openrouterModel ? ` \u00b7 ${config.openrouterModel}` : ""}`;
    case "ollama": return `Ollama${config.ollamaModel ? ` \u00b7 ${config.ollamaModel}` : ""}`;
    case "mlx": return `MLX${config.mlxModel ? ` \u00b7 ${config.mlxModel}` : ""}`;
    case "none": return "None";
    default: return p;
  }
}

interface ActivityLogPanelProps {
  refreshState: RefreshState;
  projects: Project[];
  config: AppConfig;
}

export function ActivityLogPanel({ refreshState, projects, config }: ActivityLogPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand when refresh starts
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (refreshState.active && !wasActiveRef.current) {
      setExpanded(true);
    }
    wasActiveRef.current = refreshState.active;
  }, [refreshState.active]);

  // Build the project status list from refreshState.projects map
  const projectNames = Array.from(refreshState.projects.keys());
  const progressMap = refreshState.projects;
  const refreshDone = !refreshState.active && refreshState.summary !== null;

  // Count stats
  let doneCount = 0;
  let aiScanningCount = 0;
  let errorCount = 0;
  for (const prog of progressMap.values()) {
    const s = deriveStatus(prog, refreshDone);
    if (s === "done" || s === "skipped") doneCount++;
    else if (s === "ai-scanning") aiScanningCount++;
    else if (s === "error") errorCount++;
  }
  const totalCount = projectNames.length;

  // Determine scan type from summary
  const isFastScanOnly = refreshDone && (refreshState.summary?.llmSkipped ?? 0) === totalCount && totalCount > 0;

  const isIdle = !refreshState.active && totalCount === 0;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2.5 shadow-lg hover:bg-accent transition-colors"
      >
        <Activity className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Activity</span>
        {refreshState.active && (
          <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
        )}
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {doneCount}/{totalCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed top-20 bottom-6 right-6 z-40 w-[360px] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Activity Log</span>
          {refreshState.active && (
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Minimize activity log"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Provider info — shown during active AI scan */}
      {refreshState.active && (
        <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Provider</span>
            <span className="font-medium text-foreground">{getProviderLabel(config)}</span>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="tabular-nums text-foreground">
                {doneCount + errorCount} / {totalCount}
                {aiScanningCount > 0 && <span className="text-purple-400 ml-1">({aiScanningCount} AI scanning)</span>}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Summary bar when done */}
      {refreshDone && refreshState.summary && (
        <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 text-xs">
            <Check className="size-3.5 text-emerald-400 shrink-0" />
            <span className="text-foreground">
              {isFastScanOnly ? "Fast scan" : "AI scan"}: {refreshState.summary.projectCount} projects
              {!isFastScanOnly && (refreshState.summary.llmSucceeded ?? 0) > 0 && `, ${refreshState.summary.llmSucceeded} AI scanned`}
              {(refreshState.summary.llmFailed ?? 0) > 0 && (
                <span className="text-red-400"> · {refreshState.summary.llmFailed} failed</span>
              )}
              {refreshState.summary.durationMs != null && (
                <span className="text-muted-foreground"> · {(refreshState.summary.durationMs / 1000).toFixed(1)}s</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Project list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
        {isIdle ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <Activity className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Your scan activity will appear here when you run a Fast Scan or AI Scan.
            </p>
          </div>
        ) : projectNames.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              Scanning projects...
            </p>
          </div>
        ) : (
          <div className="py-1">
            {projectNames.map((name) => {
              const prog = progressMap.get(name);
              const status = deriveStatus(prog, refreshDone);
              const isActive = status === "ai-scanning" || status === "scanning";

              return (
                <div
                  key={name}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-1.5 text-xs transition-colors",
                    isActive && "bg-muted/40"
                  )}
                >
                  <StatusIcon status={status} />
                  <span
                    className={cn(
                      "flex-1 truncate",
                      status === "pending" ? "text-muted-foreground" : "text-foreground font-medium"
                    )}
                    title={name}
                  >
                    {name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] tabular-nums",
                      status === "ai-scanning" ? "text-purple-400" :
                      status === "error" ? "text-red-400" :
                      status === "done" ? "text-emerald-400" :
                      "text-muted-foreground"
                    )}
                  >
                    {statusLabel(status)}
                    {status === "done" && prog?.llmDurationMs != null && (
                      <span className="text-muted-foreground ml-1">
                        {(prog.llmDurationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer status */}
      {refreshState.active && (
        <div className="shrink-0 px-4 py-1.5 border-t border-border text-xs text-muted-foreground truncate">
          {refreshState.phase}
        </div>
      )}
    </div>
  );
}
