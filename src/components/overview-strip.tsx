import type { Project } from "@/lib/types";
import type { FocusGoal } from "@/lib/types";
import type { ShippedData, VisitDelta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CARD, SECTION_LABEL, SIGNAL_COLORS } from "@/lib/status-colors";
import { ArrowUpRight, ArrowDownRight, Plus, Minus, Target, Rocket, RefreshCw } from "lucide-react";

/* ── Types ──────────────────────────────────────────────── */

interface OverviewStripProps {
  projects: Project[];
  focusGoals: FocusGoal[];
  shipped: ShippedData | null;
  visit: VisitDelta | null;
  visitLoading: boolean;
  focusLoading: boolean;
  shippedLoading: boolean;
  onAddFocusGoal: () => void;
  onToggleFocusGoal: (id: string, completed: boolean) => void;
  activeFilter: "uncommitted" | "open-issues" | "ci-failing" | "not-on-github" | null;
  onFilter: (filter: "uncommitted" | "open-issues" | "ci-failing" | "not-on-github" | null) => void;
  onClearAll: () => void;
}

type SignalFilter = "uncommitted" | "open-issues" | "ci-failing" | "not-on-github" | null;

/* ── Signal chip ────────────────────────────────────────── */

function SignalChip({
  label,
  value,
  filter,
  activeFilter,
  onFilter,
  accent,
}: {
  label: string;
  value: number;
  filter: "uncommitted" | "open-issues" | "ci-failing" | "not-on-github";
  activeFilter: "uncommitted" | "open-issues" | "ci-failing" | "not-on-github" | null;
  onFilter: (f: "uncommitted" | "open-issues" | "ci-failing" | "not-on-github" | null) => void;
  accent?: boolean;
}) {
  const isActive = activeFilter === filter;
  return (
    <button
      type="button"
      onClick={() => onFilter(isActive ? null : filter)}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
        isActive
          ? "bg-foreground text-background"
          : accent && value > 0
            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {value}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ── Delta chips ────────────────────────────────────────── */

function formatLastVisit(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return "a while ago";
}

function DeltaChips({ visit, loading }: { visit: VisitDelta | null; loading: boolean }) {
  if (loading) return <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>;
  if (!visit || visit.firstVisit || !visit.delta) return null;
  const d = visit.delta;
  const hasChanges = d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0;

  if (!hasChanges) {
    return (
      <span className="text-xs text-muted-foreground">
        No changes since {formatLastVisit(visit.lastVisitAt)}
      </span>
    );
  }

  const chips: Array<{ label: string; color: string; icon: React.ReactNode }> = [];
  if (d.added.length > 0) chips.push({ label: `${d.added.length} new`, color: "text-emerald-600 dark:text-emerald-400", icon: <Plus className="size-3" /> });
  if (d.removed.length > 0) chips.push({ label: `${d.removed.length} gone`, color: "text-red-600 dark:text-red-400", icon: <Minus className="size-3" /> });
  if (d.changed.length > 0) {
    const isUp = d.changed.some((c) => c.field.includes("Score") || c.field === "weekCommits");
    chips.push({
      label: `${d.changed.length} changed`,
      color: "text-amber-600 dark:text-amber-400",
      icon: isUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />,
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        Since {formatLastVisit(visit.lastVisitAt)}
      </span>
      {chips.map((c, i) => (
        <span key={i} className={cn("inline-flex items-center gap-1 text-[11px] font-medium", c.color)}>
          {c.icon}{c.label}
        </span>
      ))}
    </div>
  );
}

/* ── Focus mini ─────────────────────────────────────────── */

function FocusMini({ goals, loading, onToggle, onAdd }: {
  goals: FocusGoal[];
  loading: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onAdd: () => void;
}) {
  if (loading) return <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>;
  if (goals.length === 0) {
    return (
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Target className="size-3" />
        Set a focus goal
      </button>
    );
  }
  const done = goals.filter((g) => g.completed).length;
  return (
    <div className="flex items-center gap-2">
      <Target className="size-3.5 text-amber-500 shrink-0" />
      <span className="text-xs font-medium tabular-nums">{done}/{goals.length}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${goals.length > 0 ? (done / goals.length) * 100 : 0}%` }}
        />
      </div>
      <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
        {goals.filter((g) => !g.completed).slice(0, 2).map((g) => (
          <span key={g.id} className="truncate max-w-[100px]">{g.goal}</span>
        ))}
        {goals.filter((g) => !g.completed).length > 2 && (
          <span>+{goals.filter((g) => !g.completed).length - 2}</span>
        )}
      </div>
    </div>
  );
}

/* ── Shipped mini ───────────────────────────────────────── */

function ShippedMini({ shipped, loading }: { shipped: ShippedData | null; loading: boolean }) {
  if (loading) return <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>;
  if (!shipped) return null;
  return (
    <div className="flex items-center gap-3">
      <Rocket className="size-3.5 text-emerald-500 shrink-0" />
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="font-bold text-foreground">{shipped.weekTotal}</span>
        <span className="text-muted-foreground">7d</span>
        <span className="font-bold text-foreground">{shipped.monthTotal}</span>
        <span className="text-muted-foreground">30d</span>
        <span className="font-bold text-foreground">{shipped.quarterTotal}</span>
        <span className="text-muted-foreground">90d</span>
      </div>
    </div>
  );
}

/* ── Overview Strip ─────────────────────────────────────── */

const SIGNAL_LABELS: Record<string, string> = {
  uncommitted: "Dirty",
  "open-issues": "Issues",
  "ci-failing": "CI ✗",
  "not-on-github": "Local",
};

export function OverviewStrip({
  projects,
  focusGoals,
  shipped,
  visit,
  visitLoading,
  focusLoading,
  shippedLoading,
  onAddFocusGoal,
  onToggleFocusGoal,
  activeFilter,
  onFilter,
}: OverviewStripProps) {
  const uncommitted = projects.filter((p) => p.isDirty).length;
  const openIssues = projects.reduce((sum, p) => sum + p.openIssues, 0);
  const ciFailing = projects.filter((p) => p.ciStatus === "failure").length;
  const notOnGitHub = projects.filter((p) => p.repoVisibility === "not-on-github").length;

  const focusIdMap = new Map(focusGoals.map((g) => [g.id, g]));

  return (
    <div className="space-y-3">
      {/* Row 1: Delta + Shipped + Focus */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <DeltaChips visit={visit} loading={visitLoading} />
        <ShippedMini shipped={shipped} loading={shippedLoading} />
        <FocusMini
          goals={focusGoals}
          loading={focusLoading}
          onToggle={onToggleFocusGoal}
          onAdd={onAddFocusGoal}
        />
      </div>

      {/* Row 2: Signal chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">{projects.length} projects</span>
        <span className="text-border">·</span>
        {uncommitted > 0 && (
          <SignalChip label="dirty" value={uncommitted} filter="uncommitted" activeFilter={activeFilter} onFilter={onFilter} accent />
        )}
        {openIssues > 0 && (
          <SignalChip label="issues" value={openIssues} filter="open-issues" activeFilter={activeFilter} onFilter={onFilter} accent />
        )}
        {ciFailing > 0 && (
          <SignalChip label="CI ✗" value={ciFailing} filter="ci-failing" activeFilter={activeFilter} onFilter={onFilter} accent />
        )}
        {notOnGitHub > 0 && (
          <SignalChip label="local" value={notOnGitHub} filter="not-on-github" activeFilter={activeFilter} onFilter={onFilter} />
        )}
      </div>
    </div>
  );
}

/* ── Re-export StatsBar for Projects tab backward compat ── */

export { SignalChip };
export type { OverviewStripProps };

/* ── StatsBar kept for Projects tab ─────────────────────── */

import { useState } from "react";

export type StatsBarSignalFilter = "uncommitted" | "open-issues" | "ci-failing" | "not-on-github" | null;

interface StatsBarProps {
  projects: Project[];
  activeFilter?: StatsBarSignalFilter;
  onFilter?: (filter: StatsBarSignalFilter) => void;
  onClearAll?: () => void;
}

export function StatsBar({ projects, activeFilter, onFilter, onClearAll }: StatsBarProps) {
  const total = projects.length;
  const uncommitted = projects.filter((p) => p.isDirty).length;
  const openIssues = projects.reduce((sum, p) => sum + p.openIssues, 0);
  const ciFailing = projects.filter((p) => p.ciStatus === "failure").length;
  const notOnGitHub = projects.filter((p) => p.repoVisibility === "not-on-github").length;

  const cards: Array<{
    key: StatsBarSignalFilter;
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
              c.accent && c.key ? SIGNAL_COLORS[c.key as keyof typeof SIGNAL_COLORS] : "text-foreground"
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