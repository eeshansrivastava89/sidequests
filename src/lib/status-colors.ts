/**
 * Shared UI constants — single source of truth for colors and
 * structural CSS class patterns used across multiple components.
 *
 * DRY principle: if a color or class pattern appears in 2+ components,
 * it belongs here.
 */

// ── Project status ──────────────────────────────────────────

/** Tailwind bg-* classes for status dots and badges (HTML elements). */
export const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500",
  completed: "bg-sky-500",
  paused:    "bg-amber-500",
  archived:  "bg-zinc-400",
};

/** Hex colors for SVG elements and charts. Covers LLM + derived statuses. */
export const STATUS_COLORS_HEX: Record<string, string> = {
  building:    "#22c55e",
  shipping:    "#3b82f6",
  maintaining: "#8b5cf6",
  blocked:     "#ef4444",
  completed:   "#06b6d4",
  idea:        "#f59e0b",
  active:      "#22c55e",
  paused:      "#f59e0b",
  stale:       "#f97316",
  archived:    "#9ca3af",
};

// ── Signal accent colors (for overview strip / stats bar) ──

export const SIGNAL_COLORS = {
  uncommitted:   "text-amber-500 dark:text-amber-400",
  "open-issues": "text-amber-500 dark:text-amber-400",
  "ci-failing":  "text-red-500 dark:text-red-400",
  "not-on-github": "text-muted-foreground",
} as const;

