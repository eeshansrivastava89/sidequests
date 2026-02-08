import { toast } from "sonner";

/* ── Shared helpers for project UI components ──────────── */

export function healthColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`Copied ${label} command`),
    () => toast.error("Failed to copy")
  );
}

/**
 * Format an ISO date string as a relative time (e.g. "today", "3d ago").
 * Used in the project drawer and stats.
 */
export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return "today " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Format an ISO date as a short relative time (e.g. "just now", "5m ago").
 * Used for "last refreshed" and "last opened" timestamps.
 */
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Format "last touched" time with "Opened" prefix (e.g. "Opened 5m ago").
 * Used in project-list rows.
 */
export function formatLastTouched(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Opened just now";
  if (mins < 60) return `Opened ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Opened ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Opened ${days}d ago`;
}
