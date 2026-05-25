import type { Project, VisitDelta, ShippedData, FocusGoal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CARD, SECTION_LABEL } from "@/lib/status-colors";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Activity,
  Rocket,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus as MinusIcon,
  Heart,
  Clock,
} from "lucide-react";
import { ShippedSection } from "@/components/shipped-section";

/* ── Types ──────────────────────────────────────────────── */

interface AnalyticsTabProps {
  projects: Project[];
  shipped: ShippedData | null;
  shippedLoading: boolean;
  visit: VisitDelta | null;
  visitLoading: boolean;
  focusGoals: FocusGoal[];
  focusLoading: boolean;
  onToggleFocusGoal: (id: string, completed: boolean) => void;
  onAddFocusGoal: () => void;
  onSelectProject: (id: string) => void;
}

/* ── Momentum ───────────────────────────────────────────── */

type Momentum = "accelerating" | "steady" | "decelerating" | "stalled";

function getMomentum(p: Project): Momentum {
  const { weekCommits, monthCommits, quarterCommits } = p;
  // If no commits in the quarter, stalled
  if (quarterCommits === 0) return "stalled";
  // Normalize to weekly rates
  const weekRate = weekCommits;
  const monthRate = monthCommits / 4;
  const quarterRate = quarterCommits / 12;
  // If this week > month avg > quarter avg, accelerating
  if (weekRate >= monthRate * 1.3 && monthRate >= quarterRate * 0.8) return "accelerating";
  // If this week < month avg * 0.5, decelerating
  if (weekRate <= monthRate * 0.5) return "decelerating";
  // Steady: within rough parity
  return "steady";
}

const MOMENTUM_CONFIG: Record<Momentum, { icon: typeof TrendingUp; label: string; color: string }> = {
  accelerating: { icon: TrendingUp, label: "Accelerating", color: "text-emerald-500" },
  steady: { icon: Minus, label: "Steady", color: "text-blue-400" },
  decelerating: { icon: TrendingDown, label: "Decelerating", color: "text-amber-500" },
  stalled: { icon: Clock, label: "Stalled", color: "text-muted-foreground" },
};

/* ── Activity Bars ──────────────────────────────────────── */

function ActivityBars({ projects, onSelectProject }: { projects: Project[]; onSelectProject: (id: string) => void }) {
  // Only show projects with any commits in the quarter
  const active = projects
    .filter((p) => p.quarterCommits > 0)
    .sort((a, b) => b.quarterCommits - a.quarterCommits);

  if (active.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No commit activity yet. Run a scan to see project activity.
      </div>
    );
  }

  const maxQuarter = active[0]?.quarterCommits ?? 1;

  return (
    <div className="space-y-2">
      {active.map((p) => {
        const momentum = getMomentum(p);
        const mConfig = MOMENTUM_CONFIG[momentum];
        const MIcon = mConfig.icon;
        const quarterPct = Math.round((p.quarterCommits / maxQuarter) * 100);
        const weekPct = p.weekCommits > 0 ? Math.round((p.weekCommits / maxQuarter) * 100) : 0;

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectProject(p.id)}
            className="w-full text-left hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium truncate min-w-[100px] max-w-[140px]" title={p.name}>
                {p.name}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                {/* Quarter bar (total) */}
                <div
                  className="absolute inset-y-0 left-0 bg-muted-foreground/20 rounded-full"
                  style={{ width: `${quarterPct}%` }}
                />
                {/* Week bar (recent) */}
                {weekPct > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-foreground rounded-full"
                    style={{ width: `${weekPct}%` }}
                  />
                )}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0 w-16 text-right">
                {p.quarterCommits}
                <span className="text-muted-foreground/60">/90d</span>
              </span>
              <MIcon className={cn("size-3.5 shrink-0", mConfig.color)} />
            </div>
          </button>
        );
      })}
      <div className="flex items-center gap-4 pt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 bg-foreground rounded" /> This week</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 bg-muted-foreground/20 rounded" /> 90d total</span>
        <span className="flex items-center gap-1"><TrendingUp className="size-3 text-emerald-500" /> Accelerating</span>
        <span className="flex items-center gap-1"><TrendingDown className="size-3 text-amber-500" /> Decelerating</span>
        <span className="flex items-center gap-1"><Clock className="size-3 text-muted-foreground" /> Stalled</span>
      </div>
    </div>
  );
}

/* ── Health Distribution ────────────────────────────────── */

function HealthDistribution({ projects }: { projects: Project[] }) {
  const groups = [
    { label: "Active", status: "active", color: STATUS_DOT_COLORS.active },
    { label: "Paused", status: "paused", color: STATUS_DOT_COLORS.paused },
    { label: "Stale", status: "stale", color: STATUS_DOT_COLORS.stale },
    { label: "Completed", status: "completed", color: STATUS_DOT_COLORS.completed },
    { label: "Archived", status: "archived", color: STATUS_DOT_COLORS.archived },
  ];

  const counts = groups.map((g) => ({
    ...g,
    count: projects.filter((p) => p.status === g.status).length,
    avgHealth: projects
      .filter((p) => p.status === g.status)
      .reduce((sum, p) => sum + p.healthScore, 0) / (projects.filter((p) => p.status === g.status).length || 1),
  }));

  return (
    <div className="space-y-2">
      {counts.filter((c) => c.count > 0).map((c) => (
        <div key={c.status} className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full shrink-0", c.color)} />
          <span className="text-xs font-medium min-w-[80px]">{c.label}</span>
          <span className="text-xs tabular-nums">{c.count}</span>
          <div className="flex-1" />
          <span className="text-[11px] text-muted-foreground tabular-nums">
            avg health {c.avgHealth > 0 ? c.avgHealth.toFixed(0) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

const STATUS_DOT_COLORS: Record<string, string> = {
  active: "bg-emerald-500",
  completed: "bg-blue-500",
  paused: "bg-amber-500",
  stale: "bg-orange-500",
  archived: "bg-muted-foreground",
};

/* ── Visit Delta Detail ─────────────────────────────────── */

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

function VisitDeltaDetail({ visit, projects, loading }: { visit: VisitDelta | null; projects: Project[]; loading: boolean }) {
  if (loading) return <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>;
  if (!visit || visit.firstVisit) {
    return <span className="text-xs text-muted-foreground">No prior visit — your next visit will show what changed.</span>;
  }

  const d = visit.delta;
  if (!d) return null;

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const hasChanges = d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0;

  if (!hasChanges) {
    return (
      <span className="text-xs text-muted-foreground">
        No changes since {formatLastVisit(visit.lastVisitAt)}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground">
        Since {formatLastVisit(visit.lastVisitAt)}
      </span>
      {d.added.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">New projects</span>
          {d.added.map((id) => {
            const p = projectMap.get(id);
            return (
              <div key={id} className="flex items-center gap-1.5 text-xs">
                <Plus className="size-3 text-emerald-500" />
                <span>{p?.name ?? id}</span>
              </div>
            );
          })}
        </div>
      )}
      {d.removed.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-red-500">Removed</span>
          {d.removed.map((id) => (
            <div key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MinusIcon className="size-3 text-red-400" />
              <span>{id}</span>
            </div>
          ))}
        </div>
      )}
      {d.changed.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-amber-500">Changed</span>
          {d.changed.map((c) => {
            const p = projectMap.get(c.id);
            const isUp = c.field.includes("Score") || c.field === "weekCommits";
            return (
              <div key={c.id} className="flex items-center gap-1.5 text-xs">
                {isUp
                  ? <ArrowUpRight className="size-3 text-amber-500" />
                  : <ArrowDownRight className="size-3 text-amber-500" />
                }
                <span className="font-medium">{p?.name ?? c.name}</span>
                <span className="text-muted-foreground">
                  {c.field}: <span className="text-foreground">{String(c.from)}</span> → <span className="text-foreground">{String(c.to)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Momentum Section ────────────────────────────────────── */

function MomentumSection({ projects }: { projects: Project[] }) {
  const groups: { momentum: Momentum; projects: Project[] }[] = [
    { momentum: "accelerating", projects: [] },
    { momentum: "steady", projects: [] },
    { momentum: "decelerating", projects: [] },
    { momentum: "stalled", projects: [] },
  ];

  for (const p of projects) {
    const m = getMomentum(p);
    const group = groups.find((g) => g.momentum === m);
    group?.projects.push(p);
  }

  return (
    <div className="space-y-3">
      {groups
        .filter((g) => g.projects.length > 0)
        .map((g) => {
          const config = MOMENTUM_CONFIG[g.momentum];
          const Icon = config.icon;
          return (
            <div key={g.momentum}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn("size-3.5", config.color)} />
                <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">({g.projects.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.projects.map((p) => (
                  <span
                    key={p.id}
                    className="text-[11px] bg-muted px-2 py-0.5 rounded-md font-medium"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

/* ── Main Analytics Tab ──────────────────────────────────── */

export function AnalyticsTab({
  projects,
  shipped,
  shippedLoading,
  visit,
  visitLoading,
  focusGoals,
  focusLoading,
  onToggleFocusGoal,
  onAddFocusGoal,
  onSelectProject,
}: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      {/* Shipped — moved from What Now */}
      <ShippedSection shipped={shipped} loading={shippedLoading} />

      {/* Activity: commit bars per project */}
      <div className={CARD}>
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border">
          <BarChart3 className="size-3.5 text-blue-500" />
          <h3 className={SECTION_LABEL}>Activity</h3>
        </div>
        <div className="px-4 py-3">
          <ActivityBars projects={projects} onSelectProject={onSelectProject} />
        </div>
      </div>

      {/* Momentum: accelerating / steady / decelerating / stalled */}
      <div className={CARD}>
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border">
          <Activity className="size-3.5 text-amber-500" />
          <h3 className={SECTION_LABEL}>Momentum</h3>
        </div>
        <div className="px-4 py-3">
          <MomentumSection projects={projects} />
        </div>
      </div>

      {/* Health distribution */}
      <div className={CARD}>
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border">
          <Heart className="size-3.5 text-red-400" />
          <h3 className={SECTION_LABEL}>Portfolio Health</h3>
        </div>
        <div className="px-4 py-3">
          <HealthDistribution projects={projects} />
        </div>
      </div>

      {/* Visit delta — detailed */}
      <div className={CARD}>
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border">
          <Rocket className="size-3.5 text-emerald-500" />
          <h3 className={SECTION_LABEL}>Since Last Visit</h3>
        </div>
        <div className="px-4 py-3">
          <VisitDeltaDetail visit={visit} projects={projects} loading={visitLoading} />
        </div>
      </div>
    </div>
  );
}