"use client";

import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SignalFilter = "uncommitted" | "open-issues" | "ci-failing" | "not-on-github" | null;

interface StatsBarProps {
  projects: Project[];
  activeFilter?: SignalFilter;
  onFilter?: (filter: SignalFilter) => void;
  onClearAll?: () => void;
}

/* Catppuccin-aligned accent colors per card type */
const ACCENT_CLASSES: Record<string, string> = {
  uncommitted: "text-[#fab387] dark:text-[#fab387]",     // peach
  "open-issues": "text-[#fab387] dark:text-[#fab387]",   // peach
  "ci-failing": "text-[#f38ba8] dark:text-[#f38ba8]",    // red
  "not-on-github": "text-muted-foreground",               // grey/muted
};

export function StatsBar({ projects, activeFilter, onFilter, onClearAll }: StatsBarProps) {
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
                if (onClearAll) { onClearAll(); } else { onFilter?.(null); }
              } else {
                onFilter?.(isActive ? null : c.key);
              }
            }}
            className={cn(
              "rounded-xl border bg-card px-5 py-4 text-center transition-colors",
              isActive
                ? "border-amber-500 ring-1 ring-amber-500/50"
                : "border-border",
              isClickable && !isActive && "hover:border-muted-foreground/40 cursor-pointer",
              !isClickable && "cursor-default"
            )}
          >
            <div className={cn(
              "text-3xl font-bold tracking-tight",
              c.accent && c.key ? ACCENT_CLASSES[c.key] : "text-foreground"
            )}>
              {c.value}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
          </button>
        );
      })}
    </div>
  );
}
