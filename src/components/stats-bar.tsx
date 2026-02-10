"use client";

import type { Project } from "@/lib/types";
import type { DashboardDeltas } from "@/hooks/use-refresh-deltas";
import { evaluateAttention } from "@/lib/attention";

interface StatsBarProps {
  projects: Project[];
  deltas?: DashboardDeltas | null;
}

export function StatsBar({ projects, deltas }: StatsBarProps) {
  const total = projects.length;
  const dirty = projects.filter((p) => p.isDirty).length;
  const unpushed = projects.filter((p) => p.ahead > 0).length;
  const needsAttention = projects.filter((p) => evaluateAttention(p).needsAttention).length;
  const avgHealth =
    total > 0 ? Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / total) : 0;

  // increaseGood: true = increase is good (green ↑), false = bad (red ↑), null = neutral
  const stats: Array<{ label: string; value: string | number; accent?: boolean; delta?: number; increaseGood: boolean | null }> = [
    { label: "Total", value: total, delta: deltas?.totalCount, increaseGood: null },
    { label: "Uncommitted", value: dirty, accent: dirty > 0, delta: deltas?.dirtyCount, increaseGood: false },
    { label: "Unpushed", value: unpushed, accent: unpushed > 0, delta: deltas?.unpushedCount, increaseGood: false },
    { label: "Needs Attention", value: needsAttention, accent: needsAttention > 0, delta: deltas?.needsAttention, increaseGood: false },
    { label: "Avg Health", value: `${avgHealth}/100`, delta: deltas?.avgHealth, increaseGood: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-border bg-card px-4 py-3 text-center"
        >
          <div className={`text-2xl font-semibold tracking-tight ${
            "accent" in s && s.accent ? "text-amber-600 dark:text-amber-400" : "text-foreground"
          }`}>
            {s.value}
            {s.delta != null && s.delta !== 0 && (
              <span className={`text-[10px] font-medium ml-1 ${
                s.increaseGood === null
                  ? "text-muted-foreground"
                  : (s.delta > 0) === s.increaseGood
                    ? "text-emerald-600"
                    : "text-red-500"
              }`}>
                {s.delta > 0 ? `↑${s.delta}` : `↓${Math.abs(s.delta)}`}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
