import { useState, useEffect, useCallback } from "react";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Activity,
  Heart,
  Rocket,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus as MinusIcon,
  Zap,
  AlertCircle,
  GitBranch,
  Eye,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { ShippedSection } from "@/components/shipped-section";
import type { VisitDelta, ShippedData, FocusGoal } from "@/lib/types";

/* ── Types ──────────────────────────────────────────────── */

interface PortfolioStats {
  ok: boolean;
  statusCounts: Record<string, number>;
  velocity: Array<{
    id: string;
    name: string;
    week: number;
    month: number;
    quarter: number;
    healthScore: number;
    status: string;
  }>;
  totals: {
    projects: number;
    weekCommits: number;
    monthCommits: number;
    quarterCommits: number;
  };
  momentum: {
    accelerating: number;
    steady: number;
    decelerating: number;
    stalled: number;
  };
  momentumProjects: Record<string, string[]>;
  signals: {
    dirty: number;
    ciFailing: number;
    openIssues: number;
    notOnGitHub: number;
  };
  topActive: Array<{
    id: string;
    name: string;
    week: number;
    month: number;
    quarter: number;
    healthScore: number;
    status: string;
  }>;
  stalled: Array<{
    id: string;
    name: string;
    week: number;
    month: number;
    quarter: number;
    healthScore: number;
    status: string;
  }>;
}

interface AnalyticsTabProps {
  projects: Project[];
  shipped: ShippedData | null;
  shippedLoading: boolean;
  visit: VisitDelta | null;
  visitLoading: boolean;
  onSelectProject: (id: string) => void;
}

/* ── Chart colors ──────────────────────────────────────── */

const COLORS = {
  chart1: "var(--chart-1)",
  chart2: "var(--chart-2)",
  chart3: "var(--chart-3)",
  chart4: "var(--chart-4)",
  chart5: "var(--chart-5)",
};

const STATUS_COLORS_MAP: Record<string, string> = {
  building: "#22c55e",
  shipping: "#3b82f6",
  maintaining: "#8b5cf6",
  blocked: "#ef4444",
  completed: "#06b6d4",
  idea: "#f59e0b",
  active: "#22c55e",
  paused: "#f59e0b",
  stale: "#f97316",
  archived: "#9ca3af",
};

const STATUS_LABELS: Record<string, string> = {
  building: "Building",
  shipping: "Shipping",
  maintaining: "Maintaining",
  blocked: "Blocked",
  completed: "Completed",
  idea: "Idea",
  active: "Active",
  paused: "Paused",
  stale: "Stale",
  archived: "Archived",
};

/* ── Momentum ──────────────────────────────────────────── */

type Momentum = "accelerating" | "steady" | "decelerating" | "stalled";

const MOMENTUM_CONFIG: Record<Momentum, { icon: typeof TrendingUp; label: string; color: string; bg: string }> = {
  accelerating: { icon: TrendingUp, label: "Accelerating", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  steady: { icon: Minus, label: "Steady", color: "text-blue-400", bg: "bg-blue-500/10" },
  decelerating: { icon: TrendingDown, label: "Decelerating", color: "text-amber-500", bg: "bg-amber-500/10" },
  stalled: { icon: Clock, label: "Stalled", color: "text-muted-foreground", bg: "bg-muted" },
};

/* ── Custom tooltip ─────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      {label && <p className="font-medium mb-1 truncate max-w-[200px]">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-mono font-medium ml-auto tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Visit Delta ─────────────────────────────────────────── */

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
  if (!visit || visit.firstVisit) return <span className="text-xs text-muted-foreground">Your first visit — next time you'll see what changed.</span>;

  const d = visit.delta;
  if (!d) return null;

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const hasChanges = d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0;

  if (!hasChanges) {
    return <span className="text-xs text-muted-foreground">No changes since {formatLastVisit(visit.lastVisitAt)}</span>;
  }

  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground">Since {formatLastVisit(visit.lastVisitAt)}</span>
      {d.added.length > 0 && (
        <div className="space-y-1">
          {d.added.map((id) => {
            const p = projectMap.get(id);
            return (
              <div key={id} className="flex items-center gap-2 text-xs">
                <Plus className="size-3 text-emerald-500" />
                <span className="font-medium">{p?.name ?? id}</span>
                <span className="text-emerald-500">new</span>
              </div>
            );
          })}
        </div>
      )}
      {d.removed.length > 0 && (
        <div className="space-y-1">
          {d.removed.map((id) => (
            <div key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <MinusIcon className="size-3 text-red-400" />
              <span>{id}</span>
              <span className="text-red-400">removed</span>
            </div>
          ))}
        </div>
      )}
      {d.changed.length > 0 && (
        <div className="space-y-1">
          {d.changed.map((c) => {
            const p = projectMap.get(c.id);
            const isUp = c.field.includes("Score") || c.field === "weekCommits";
            return (
              <div key={c.id} className="flex items-center gap-2 text-xs">
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

/* ── Analytics Tab ──────────────────────────────────────── */

export function AnalyticsTab({
  projects,
  shipped,
  shippedLoading,
  visit,
  visitLoading,
  onSelectProject,
}: AnalyticsTabProps) {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setStats(data);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [projects]);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const { totals, statusCounts, momentum, momentumProjects, signals, topActive, velocity } = stats;

  // Pie chart data for status distribution
  const pieData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_LABELS[status] ?? status,
      value: count,
      fill: STATUS_COLORS_MAP[status] ?? "#9ca3af",
    }));

  // Bar chart data for top active projects (commits)
  const barData = topActive.slice(0, 6).map((p) => ({
    name: p.name.length > 14 ? p.name.slice(0, 12) + "…" : p.name,
    week: p.week,
    monthPrior: p.month - p.week, // commits in rest-of-month excluding this week
    quarterPrior: Math.max(0, p.quarter - p.month), // commits in rest-of-quarter excluding month
  }));

  // Total commits across time periods
  const commitTrend = [
    { period: "7d", commits: totals.weekCommits },
    { period: "30d", commits: totals.monthCommits },
    { period: "90d", commits: totals.quarterCommits },
  ];

  return (
    <div className="space-y-6">
      {/* ── Snapshot Hero ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-2xl font-bold tracking-tight tabular-nums">{totals.projects}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Projects</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-2xl font-bold tracking-tight tabular-nums text-emerald-500">{totals.weekCommits}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Commits this week</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-2xl font-bold tracking-tight tabular-nums">{signals.openIssues}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Open issues</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-1.5">
            {signals.ciFailing > 0 && <AlertCircle className="size-4 text-red-500" />}
            {signals.dirty > 0 && <GitBranch className="size-4 text-amber-500" />}
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums">{signals.ciFailing + signals.dirty}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Needs attention</div>
        </div>
      </div>

      {/* ── Commit Velocity ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
          <BarChart3 className="size-3.5 text-blue-500" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Commit Velocity</h3>
        </div>
        <div className="px-5 py-4">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="week" stackId="a" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} name="This week" />
                <Bar dataKey="monthPrior" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} name="Rest of month" />
                <Bar dataKey="quarterPrior" stackId="a" fill="hsl(var(--chart-3))" radius={[0, 0, 2, 2]} name="Prior 60d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded" style={{ background: "hsl(var(--chart-1))" }} /> This week</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded" style={{ background: "hsl(var(--chart-2))" }} /> Rest of month</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded" style={{ background: "hsl(var(--chart-3))" }} /> Prior 60d</span>
          </div>
        </div>
      </div>

      {/* ── Portfolio Health + Momentum ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution pie */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
            <Heart className="size-3.5 text-red-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Health</h3>
          </div>
          <div className="px-5 py-4">
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-[160px] w-[160px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="size-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                      <span className="text-xs font-medium">{d.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No status data yet. Run an AI scan to see health distribution.</p>
            )}
          </div>
        </div>

        {/* Momentum */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
            <Activity className="size-3.5 text-amber-500" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Momentum</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            {(Object.entries(momentum) as [Momentum, number][]).filter(([, count]) => count > 0).map(([m, count]) => {
              const config = MOMENTUM_CONFIG[m];
              const Icon = config.icon;
              const names = momentumProjects[m] ?? [];
              return (
                <div key={m}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={cn("flex items-center justify-center size-6 rounded-md", config.bg)}>
                      <Icon className={cn("size-3.5", config.color)} />
                    </div>
                    <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                  </div>
                  {names.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 ml-8">
                      {names.slice(0, 6).map((name) => (
                        <span
                          key={name}
                          className="text-[11px] bg-muted px-2 py-0.5 rounded-md font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => {
                            const p = projects.find((p) => p.name === name);
                            if (p) onSelectProject(p.id);
                          }}
                        >
                          {name}
                        </span>
                      ))}
                      {names.length > 6 && <span className="text-[11px] text-muted-foreground">+{names.length - 6} more</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Shipped ── */}
      <ShippedSection shipped={shipped} loading={shippedLoading} />

      {/* ── Since Last Visit ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
          <Eye className="size-3.5 text-emerald-500" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Since Last Visit</h3>
        </div>
        <div className="px-5 py-4">
          <VisitDeltaDetail visit={visit} projects={projects} loading={visitLoading} />
        </div>
      </div>
    </div>
  );
}