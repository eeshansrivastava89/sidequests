"use client";

import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SignalFilter = "uncommitted" | "open-issues" | "ci-failing" | "not-on-github" | null;

interface StatsBarProps {
  projects: Project[];
  activeFilter?: SignalFilter;
  onFilter?: (filter: SignalFilter) => void;
}

export function StatsBar({ projects, activeFilter, onFilter }: StatsBarProps) {
  const total = projects.length;
  const uncommitted = projects.filter((p) => p.isDirty).length;
  const openIssues = projects.reduce((sum, p) => sum + p.openIssues, 0);
  const ciFailing = projects.filter((p) => p.ciStatus === "failure").length;
  const notOnGitHub = projects.filter((p) => p.repoVisibility === "not-on-github").length;

  const cards: Array<{
    key: SignalFilter;
    label: string;
    value: number;
    accent: boolean;
  }> = [
    { key: null, label: "Projects", value: total, accent: false },
    { key: "uncommitted", label: "Uncommitted", value: uncommitted, accent: uncommitted > 0 },
    { key: "open-issues", label: "Open Issues", value: openIssues, accent: openIssues > 0 },
    { key: "ci-failing", label: "CI Failing", value: ciFailing, accent: ciFailing > 0 },
    { key: "not-on-github", label: "Not on GitHub", value: notOnGitHub, accent: notOnGitHub > 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const isActive = c.key !== null && activeFilter === c.key;
        const isClickable = Boolean(onFilter);
        return (
          <button
            key={c.label}
            type="button"
            disabled={!isClickable}
            onClick={() => {
              if (!isClickable) return;
              if (c.key === null) {
                onFilter?.(null);
              } else {
                onFilter?.(isActive ? null : c.key);
              }
            }}
            className={cn(
              "rounded-lg border bg-card px-4 py-3 text-center transition-colors",
              isActive
                ? "border-amber-500 ring-1 ring-amber-500/50"
                : "border-border",
              isClickable && !isActive && "hover:border-muted-foreground/40 cursor-pointer",
              !isClickable && "cursor-default"
            )}
          >
            <div className={cn(
              "text-2xl font-semibold tracking-tight",
              c.accent ? "text-amber-600 dark:text-amber-400" : "text-foreground"
            )}>
              {c.value}
            </div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </button>
        );
      })}
    </div>
  );
}
