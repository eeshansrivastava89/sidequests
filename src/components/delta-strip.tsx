
import type { VisitDelta } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, Plus, Minus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeltaStripProps {
  visit: VisitDelta | null;
  loading: boolean;
}

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

export function DeltaStrip({ visit, loading }: DeltaStripProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-card animate-pulse">
        <RefreshCw className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading visit data...</span>
      </div>
    );
  }

  if (!visit || visit.firstVisit) {
    return null;
  }

  const delta = visit.delta;
  if (!delta) return null;

  const hasChanges = delta.added.length > 0 || delta.removed.length > 0 || delta.changed.length > 0;

  if (!hasChanges) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-card">
        <RefreshCw className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          No changes since last visit ({formatLastVisit(visit.lastVisitAt)})
        </span>
      </div>
    );
  }

  const chips: Array<{ label: string; color: string; icon: React.ReactNode }> = [];

  if (delta.added.length > 0) {
    chips.push({
      label: `${delta.added.length} new`,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
      icon: <Plus className="size-3.5" />,
    });
  }
  if (delta.removed.length > 0) {
    chips.push({
      label: `${delta.removed.length} removed`,
      color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40",
      icon: <Minus className="size-3.5" />,
    });
  }
  if (delta.changed.length > 0) {
    // Group changes by field
    const byField = new Map<string, number>();
    for (const c of delta.changed) {
      byField.set(c.field, (byField.get(c.field) ?? 0) + 1);
    }
    const topFields = Array.from(byField.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [field, count] of topFields) {
      const isUp = field.includes("Score") || field === "weekCommits" || field === "monthCommits";
      chips.push({
        label: `${count} ${field}${count > 1 ? "s" : ""} changed`,
        color: isUp
          ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
          : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
        icon: isUp
          ? <ArrowUpRight className="size-3.5" />
          : <ArrowDownRight className="size-3.5" />,
      });
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card">
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        Since {formatLastVisit(visit.lastVisitAt)}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {chips.map((chip, i) => (
          <span
            key={i}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", chip.color)}
          >
            {chip.icon}
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}