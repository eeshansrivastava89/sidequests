import { useMemo } from "react";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LifecycleTimelineProps {
  projects: Project[];
  onSelect: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  building: "#22c55e",
  shipping: "#3b82f6",
  maintaining: "#8b5cf6",
  blocked: "#ef4444",
  completed: "#06b6d4",
  idea: "#f59e0b",
  active: "#22c55e",
  paused: "#f59e0b",
  stale: "#f97316",
  archived: "#9ca3af",
};

const STATUS_LABELS: Record<string, string> = {
  building: "Building",
  shipping: "Shipping",
  maintaining: "Maintaining",
  blocked: "Blocked",
  completed: "Completed",
  idea: "Idea",
  active: "Active",
  paused: "Paused",
  stale: "Stale",
  archived: "Archived",
};

function ageLabel(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  const years = days / 365;
  if (years < 1.5) return `${Math.round(days / 30)}mo`;
  return `${years.toFixed(1)}y`;
}

export function LifecycleTimeline({ projects, onSelect }: LifecycleTimelineProps) {
  const rows = useMemo(() => {
    const now = Date.now();
    return projects
      .filter((p) => p.status !== "archived")
      .map((p) => {
        const created = p.createdAt ? new Date(p.createdAt).getTime() : now;
        const ageDays = Math.max(1, Math.floor((now - created) / 86400000));
        const lastCommit = p.lastCommitDate ? new Date(p.lastCommitDate).getTime() : null;
        const daysSinceCommit = lastCommit ? Math.floor((now - lastCommit) / 86400000) : 999;
        const status = p.llmStatus ?? p.status;

        // Activity segments: divide age into 4 activity bands
        // week (0-7d ago), month (7-30d), quarter (30-90d), older
        const weekPct = Math.min(1, p.weekCommits > 0 ? 7 / ageDays : 0);
        const monthPct = Math.min(1, p.monthCommits > 0 ? 30 / ageDays : 0) - weekPct;
        const quarterPct = Math.min(1, p.quarterCommits > 0 ? 90 / ageDays : 0) - weekPct - monthPct;

        return {
          id: p.id,
          name: p.name,
          status,
          healthScore: p.healthScore,
          ageDays,
          daysSinceCommit,
          weekCommits: p.weekCommits,
          monthCommits: p.monthCommits,
          quarterCommits: p.quarterCommits,
          weekPct,
          monthPct,
          quarterPct,
          lastCommitDays: daysSinceCommit,
        };
      })
      .sort((a, b) => a.daysSinceCommit - b.daysSinceCommit);
  }, [projects]);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-4">No active projects to display.</p>;
  }

  return (
    <div className="space-y-1">
      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm bg-emerald-500/80" /> This week
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm bg-blue-400/60" /> This month
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm bg-blue-400/30" /> This quarter
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-sm bg-muted" /> Older
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.active }} /> Status
        </span>
      </div>

      {rows.map((row) => {
        const statusColor = STATUS_COLORS[row.status] ?? "#9ca3af";
        const statusLabel = STATUS_LABELS[row.status] ?? row.status;
        const activityPct = row.quarterPct + row.monthPct + row.weekPct;

        return (
          <button
            key={row.id}
            type="button"
            className="w-full text-left flex items-center gap-2 py-1 px-1 hover:bg-muted/30 rounded transition-colors group"
            onClick={() => onSelect(row.id)}
          >
            {/* Status dot */}
            <span
              className="inline-block size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: statusColor }}
              title={statusLabel}
            />

            {/* Project name */}
            <span className="text-xs font-medium min-w-[100px] max-w-[140px] truncate">{row.name}</span>

            {/* Timeline bar */}
            <div className="flex-1 h-4 rounded-sm bg-muted/50 overflow-hidden relative">
              {/* Older (background) */}
              <div className="absolute inset-0 bg-muted" />
              {/* Quarter (30-90d) */}
              {row.quarterPct > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-blue-400/30"
                  style={{ left: `${(1 - row.quarterPct - row.monthPct - row.weekPct) * 100}%`, width: `${row.quarterPct * 100}%` }}
                />
              )}
              {/* Month (7-30d) */}
              {row.monthPct > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-blue-400/60"
                  style={{ left: `${(1 - row.monthPct - row.weekPct) * 100}%`, width: `${row.monthPct * 100}%` }}
                />
              )}
              {/* Week (0-7d) */}
              {row.weekPct > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500/80"
                  style={{ left: `${(1 - row.weekPct) * 100}%`, width: `${row.weekPct * 100}%` }}
                />
              )}
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-2 min-w-[100px] justify-end">
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground" title={`${row.weekCommits}/${row.monthCommits}/${row.quarterCommits} commits`}>
                {row.weekCommits}/{row.monthCommits}/{row.quarterCommits}
              </span>
              <span className="text-[10px] text-muted-foreground min-w-[36px] text-right" title={`${row.ageDays} days old`}>
                {ageLabel(row.ageDays)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}