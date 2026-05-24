/**
 * Shared UI constants — single source of truth for colors, badges, and
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

// ── Action severity colors ─────────────────────────────────

export const SEVERITY_COLORS = {
  high: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  med:  { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  low:  { dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
} as const;

// ── Action source badges ────────────────────────────────────

export const SOURCE_COLORS = {
  git:   "text-amber-600 dark:text-amber-400",
  issue: "text-blue-600 dark:text-blue-400",
  ai:    "text-violet-600 dark:text-violet-400",
  stale: "text-muted-foreground",
} as const;

// ── Signal accent colors (for overview strip / stats bar) ──

export const SIGNAL_COLORS = {
  uncommitted:   "text-amber-500 dark:text-amber-400",
  "open-issues": "text-amber-500 dark:text-amber-400",
  "ci-failing":  "text-red-500 dark:text-red-400",
  "not-on-github": "text-muted-foreground",
} as const;

// ── Shared structural CSS patterns ──────────────────────────

/** Section card wrapper — used by FocusSection, ShippedSection, etc. */
export const CARD = "rounded-lg border border-border bg-card overflow-hidden";

/** Section header inside a card — icon + title + optional count */
export const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

/** Small badge pill — e.g. "uncommitted (3)", "CI ✗", source badges */
export const BADGE_PILL =
  "inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5 leading-none";

/**
 * Badge pill with semantic color variants.
 * Usage: `cn(BADGE_PILL, BADGE_VARIANTS.amber)` etc.
 */
export const BADGE_VARIANTS: Record<string, string> = {
  amber:   "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
  blue:    "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
  red:     "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
  emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
  muted:   "text-muted-foreground bg-muted",
  violet:  "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30",
};