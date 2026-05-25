/**
 * Shared UI constants — single source of truth for colors and
 * structural CSS class patterns used across multiple components.
 *
 * DRY principle: if a color or class pattern appears in 2+ components,
 * it belongs here.
 */

// ── Project status dot colors ──────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500",
  completed: "bg-sky-500",
  paused:    "bg-amber-500",
  archived:  "bg-zinc-400",
};

// ── Signal accent colors (for overview strip / stats bar) ──

export const SIGNAL_COLORS = {
  uncommitted:   "text-amber-500 dark:text-amber-400",
  "open-issues": "text-amber-500 dark:text-amber-400",
  "ci-failing":  "text-red-500 dark:text-red-400",
  "not-on-github": "text-muted-foreground",
} as const;

// ── Shared structural CSS patterns ──────────────────────────

/** Section card wrapper — used by ShippedSection and other tab sections. */
export const CARD = "rounded-lg border border-border bg-card overflow-hidden";

/** Section header inside a card — icon + title + optional count */
export const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";