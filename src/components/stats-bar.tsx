"use client";

import type { Project } from "@/lib/types";

interface StatsBarProps {
  projects: Project[];
}

export function StatsBar({ projects }: StatsBarProps) {
  const total = projects.length;
  const dirty = projects.filter((p) => p.isDirty).length;
  const unpushed = projects.filter((p) => p.ahead > 0).length;
  const needsAttention = projects.filter((p) => {
    const di = p.scan?.daysInactive ?? 0;
    return p.healthScore < 40 || (di > 30 && !p.nextAction) || (p.isDirty && di > 7);
  }).length;
  const avgHealth =
    total > 0 ? Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / total) : 0;

  const stats = [
    { label: "Total", value: total },
    { label: "Dirty", value: dirty, accent: dirty > 0 },
    { label: "Unpushed", value: unpushed, accent: unpushed > 0 },
    { label: "Needs Attention", value: needsAttention, accent: needsAttention > 0 },
    { label: "Avg Health", value: `${avgHealth}/100` },
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
          </div>
          <div className="text-xs text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
