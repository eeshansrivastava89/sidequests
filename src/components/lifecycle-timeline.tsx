import { useMemo } from "react";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  GitBranch,
  CircleDot,
} from "lucide-react";

interface LifecycleTimelineProps {
  projects: Project[];
  onSelect: (id: string) => void;
}

// ── Status chip ──────────────────────────────────────────────
// The primary visual: a colored pill that says the status in a word.
// Derived from AI status or git signals.

type StatusTier = "blocked" | "stale" | "idle" | "active" | "done";

function getStatusTier(p: Project): StatusTier {
  if (p.ciStatus === "failure") return "blocked";
  if (p.isDirty && p.dirtyFileCount > 5) return "blocked";
  const d = p.lastCommitDate ? Math.floor((Date.now() - new Date(p.lastCommitDate).getTime()) / 86400000) : 999;
  if (d > 60) return "stale";
  if (d > 30) return "stale";
  if (d > 14) return "idle";
  if (p.status === "completed") return "done";
  return "active";
}

const TIER_META: Record<StatusTier, { label: string; pill: string; dot: string }> = {
  blocked: { label: "Blocked", pill: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20", dot: "bg-red-500" },
  stale:   { label: "Stale",   pill: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20", dot: "bg-amber-500" },
  idle:    { label: "Idle",    pill: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20", dot: "bg-zinc-400" },
  active:  { label: "Active",  pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20", dot: "bg-emerald-500" },
  done:    { label: "Done",    pill: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20", dot: "bg-blue-500" },
};

// ── Health arc ──────────────────────────────────────────────
// A tiny SVG ring (24px) showing health 0-100. Color shifts green→amber→red.

function healthColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function HealthArc({ score }: { score: number }) {
  const s = 24;
  const sw = 2.5;
  const r = (s - sw) / 2;
  const cx = s / 2;
  const cy = s / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = healthColor(score);

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}

// ── Recency text ─────────────────────────────────────────────

function lastActivityText(p: Project): string {
  if (!p.lastCommitDate) return "No commits";
  const d = Math.floor((Date.now() - new Date(p.lastCommitDate).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.round(d / 7)}w ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${(d / 365).toFixed(1)}y ago`;
}

function lastActivityColor(p: Project): string {
  if (!p.lastCommitDate) return "text-muted-foreground";
  const d = Math.floor((Date.now() - new Date(p.lastCommitDate).getTime()) / 86400000);
  if (d <= 1) return "text-emerald-600 dark:text-emerald-400";
  if (d <= 7) return "text-foreground";
  if (d <= 30) return "text-amber-600 dark:text-amber-400";
  return "text-red-500";
}

// ── Signal chips ─────────────────────────────────────────────

function Signals({ p }: { p: Project }) {
  const chips: Array<{ label: string; icon: typeof AlertTriangle; color: string }> = [];
  if (p.ciStatus === "failure") chips.push({ label: "CI failing", icon: AlertTriangle, color: "text-red-500" });
  if (p.isDirty) chips.push({ label: `${p.dirtyFileCount} uncommitted`, icon: GitBranch, color: "text-amber-500" });
  if (p.openIssues > 0) chips.push({ label: `${p.openIssues} issue${p.openIssues !== 1 ? "s" : ""}`, icon: CircleDot, color: "text-amber-500" });

  if (chips.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {chips.map((c) => {
        const Icon = c.icon;
        return (
          <span key={c.label} className={cn("inline-flex items-center gap-1 text-[11px] font-medium", c.color)}>
            <Icon className="size-3" />
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────

export function LifecycleTimeline({ projects, onSelect }: LifecycleTimelineProps) {
  const rows = useMemo(() => {
    const now = Date.now();
    return projects
      .filter((p) => p.status !== "archived")
      .map((p) => ({
        project: p,
        tier: getStatusTier(p),
        dayAgo: p.lastCommitDate ? Math.floor((now - new Date(p.lastCommitDate).getTime()) / 86400000) : 999,
      }))
      .sort((a, b) => {
        // Blocked first, then active, then idle, then stale, then done
        const order: Record<StatusTier, number> = { blocked: 0, active: 1, idle: 2, stale: 3, done: 4 };
        if (a.tier !== b.tier) return order[a.tier] - order[b.tier];
        // Within tier: most recent first (ascending days = most recent)
        return a.dayAgo - b.dayAgo;
      });
  }, [projects]);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-4">No active projects.</p>;
  }

  // CTA: derived from the data
  const blocked = rows.filter((r) => r.tier === "blocked");
  const stale = rows.filter((r) => r.tier === "stale");

  return (
    <div>
      {/* CTA line */}
      {(blocked.length > 0 || stale.length > 0) && (
        <p className="text-xs text-muted-foreground mb-4">
          {blocked.length > 0 && (
            <span className="text-red-500 font-medium">{blocked.length} blocked</span>
          )}
          {blocked.length > 0 && stale.length > 0 && " · "}
          {stale.length > 0 && (
            <span className="text-amber-500 font-medium">{stale.length} stale</span>
          )}
          {" — click to investigate."}
        </p>
      )}

      <div className="divide-y divide-border">
        {rows.map(({ project: p, tier }) => {
          const meta = TIER_META[tier];

          return (
            <button
              key={p.id}
              type="button"
              className="w-full text-left flex items-center gap-3 py-3 px-2 hover:bg-muted/30 rounded-md transition-colors"
              onClick={() => onSelect(p.id)}
            >
              {/* Status chip */}
              <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0", meta.pill)}>
                <span className={cn("size-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </span>

              {/* Project name */}
              <span className="text-sm font-medium min-w-0 max-w-[200px] truncate">{p.name}</span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Signals */}
              <Signals p={p} />

              {/* Last activity */}
              <span className={cn("text-xs tabular-nums shrink-0 min-w-[60px] text-right", lastActivityColor(p))}>
                {lastActivityText(p)}
              </span>

              {/* Health arc */}
              <HealthArc score={p.healthScore} />
            </button>
          );
        })}
      </div>
    </div>
  );
}