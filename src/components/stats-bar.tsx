"use client";

import type { Project } from "@/lib/types";

interface StatsBarProps {
  projects: Project[];
}

export function StatsBar({ projects }: StatsBarProps) {
  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const inProgress = projects.filter((p) => p.status === "in-progress").length;
  const stale = projects.filter((p) => p.status === "stale").length;
  const avgHealth =
    total > 0 ? Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / total) : 0;

  const stats = [
    { label: "Total", value: total },
    { label: "Active", value: active },
    { label: "In Progress", value: inProgress },
    { label: "Stale", value: stale },
    { label: "Avg Health", value: `${avgHealth}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-border bg-card px-4 py-3 text-center"
        >
          <div className="text-2xl font-semibold tracking-tight text-foreground">
            {s.value}
          </div>
          <div className="text-xs text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
