"use client";

import type { ShippedData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Rocket, TrendingUp } from "lucide-react";

interface ShippedSectionProps {
  shipped: ShippedData | null;
  loading: boolean;
}

const PERIODS = [
  { key: "week", label: "7d", field: "weekTotal" as const, projectField: "weekCommits" as const },
  { key: "month", label: "30d", field: "monthTotal" as const, projectField: "monthCommits" as const },
  { key: "quarter", label: "90d", field: "quarterTotal" as const, projectField: "quarterCommits" as const },
];

export function ShippedSection({ shipped, loading }: ShippedSectionProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!shipped) return null;

  // Top contributors by quarter commits
  const topProjects = [...shipped.projects]
    .filter((p) => p.quarterCommits > 0)
    .sort((a, b) => b.quarterCommits - a.quarterCommits)
    .slice(5);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-card border-b border-border flex items-center gap-2">
        <Rocket className="size-4 text-emerald-500" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Shipped
        </h3>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Totals strip */}
        <div className="grid grid-cols-3 gap-3">
          {PERIODS.map((period) => {
            const total = shipped[period.field];
            return (
              <div key={period.key} className="text-center rounded-lg bg-muted/50 px-3 py-3">
                <div className="text-2xl font-bold tracking-tight">{total}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  commits ({period.label})
                </div>
              </div>
            );
          })}
        </div>

        {/* Top contributor bars */}
        {topProjects.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="size-3" />
              Top contributors (90d)
            </div>
            {topProjects.map((p) => {
              const maxCommits = topProjects[0]?.quarterCommits ?? 1;
              const pct = Math.round((p.quarterCommits / maxCommits) * 100);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-sm font-medium min-w-[100px] truncate">{p.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">{p.quarterCommits}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}