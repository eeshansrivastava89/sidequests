import { useState, useEffect } from "react";
import type { Project } from "@/lib/types";
import type { PortfolioStats } from "@/lib/merge";
import { cn } from "@/lib/utils";
import { formatLastVisit } from "@/lib/project-helpers";
import {
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus as MinusIcon,
  GitBranch,
  Heart,
  Code2,
  Layers,
  AlertCircle,
  Github,
  GitMerge,
} from "lucide-react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ShippedSection } from "@/components/shipped-section";
import { TreemapChart } from "@/components/treemap";
import { LifecycleTimeline } from "@/components/lifecycle-timeline";
import { GitHubSignals } from "@/components/github-signals";
import type { VisitDelta, ShippedData } from "@/lib/types";
import { SECTION_LABEL } from "@/lib/status-colors";

interface AnalyticsTabProps {
  projects: Project[];
  shipped: ShippedData | null;
  shippedLoading: boolean;
  visit: VisitDelta | null;
  visitLoading: boolean;
  onSelectProject: (id: string) => void;
}

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

type Momentum = "accelerating" | "steady" | "decelerating" | "stalled";

const MOMENTUM_CONFIG: Record<Momentum, { icon: typeof TrendingUp; label: string; color: string; bg: string }> = {
  accelerating: { icon: TrendingUp, label: "Accelerating", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  steady: { icon: Minus, label: "Steady", color: "text-blue-400", bg: "bg-blue-500/10" },
  decelerating: { icon: TrendingDown, label: "Decelerating", color: "text-amber-500", bg: "bg-amber-500/10" },
  stalled: { icon: Clock, label: "Stalled", color: "text-muted-foreground", bg: "bg-muted" },
};

const VELOCITY_CHART_CONFIG: ChartConfig = {
  week: { label: "This week", color: "var(--chart-1)" },
  monthPrior: { label: "Rest of month", color: "var(--chart-2)" },
  quarterPrior: { label: "Prior 60d", color: "var(--chart-3)" },
};

const HEALTH_HIST_CONFIG: ChartConfig = {
  count: { label: "Projects", color: "var(--chart-1)" },
};

const LANGUAGE_CONFIG: ChartConfig = {
  weekCommits: { label: "7d commits", color: "var(--chart-1)" },
  count: { label: "Projects", color: "var(--chart-2)" },
};

const COMMIT_TREND_CONFIG: ChartConfig = {
  totalCommits: { label: "Total commits", color: "var(--chart-1)" },
};

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

function ContributionHeatmap({ dailyCommitCounts }: { dailyCommitCounts: Record<string, number> }) {
  const days = Object.keys(dailyCommitCounts);
  if (days.length === 0) {
    return <p className="text-xs text-muted-foreground py-4">No commit history yet. Run a scan to see your activity pattern.</p>;
  }

  const maxCommits = Math.max(1, ...Object.values(dailyCommitCounts));
  const today = new Date();
  const CELL_SIZE = 11;
  const CELL_GAP = 2;
  const WEEKS = 53;

  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - (WEEKS * 7 - 1 + startDay.getDay()));
  startDay.setHours(0, 0, 0, 0);

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  const weeks: Array<Array<{ date: string; count: number; isFuture: boolean }>> = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: Array<{ date: string; count: number; isFuture: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDay);
      cellDate.setDate(cellDate.getDate() + w * 7 + d);
      const dateStr = cellDate.toISOString().split("T")[0];
      const isFuture = cellDate > today;
      week.push({ date: dateStr, count: dailyCommitCounts[dateStr] ?? 0, isFuture });
    }
    weeks.push(week);
  }

  const monthLabels: Array<{ label: string; weekIdx: number }> = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = new Date(weeks[w][0].date);
    const month = firstDay.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ label: firstDay.toLocaleString("en", { month: "short" }), weekIdx: w });
      lastMonth = month;
    }
  }

  function getOpacity(count: number): number {
    if (count === 0) return 0.06;
    const ratio = count / maxCommits;
    if (ratio < 0.15) return 0.2;
    if (ratio < 0.4) return 0.4;
    if (ratio < 0.7) return 0.65;
    return 1;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="flex gap-0">
          <div className="flex flex-col shrink-0" style={{ width: "28px" }}>
            {dayLabels.map((label, i) => (
              <div key={i} className="text-[9px] text-muted-foreground" style={{ height: `${CELL_SIZE + CELL_GAP}px`, lineHeight: `${CELL_SIZE + CELL_GAP}px` }}>
                {label}
              </div>
            ))}
          </div>
          <div>
            <div className="flex" style={{ gap: `${CELL_GAP}px` }}>
              {monthLabels.map((ml, i) => (
                <span
                  key={i}
                  className="text-[9px] text-muted-foreground"
                  style={{
                    marginLeft: ml.weekIdx === 0 ? 0 : `${(ml.weekIdx - (monthLabels[i - 1]?.weekIdx ?? 0)) * (CELL_SIZE + CELL_GAP) - (i > 0 ? (ml.weekIdx - (monthLabels[i - 1]?.weekIdx ?? 0) - 1) * CELL_GAP : 0)}px`,
                  }}
                >
                  {ml.label}
                </span>
              ))}
            </div>
            <div className="flex" style={{ gap: `${CELL_GAP}px` }}>
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col" style={{ gap: `${CELL_GAP}px` }}>
                  {week.map((day) => (
                    <div
                      key={day.date}
                      className="rounded-[2px]"
                      style={{
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                        backgroundColor: day.isFuture
                          ? "transparent"
                          : `oklch(from var(--chart-1) l c h / ${getOpacity(day.count)})`,
                      }}
                      title={`${day.date}: ${day.count} commit${day.count !== 1 ? "s" : ""}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 mt-2 text-[9px] text-muted-foreground">
          <span>Less</span>
          {[0.06, 0.2, 0.4, 0.65, 1].map((o) => (
            <div
              key={o}
              className="rounded-[2px]"
              style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px`, backgroundColor: `oklch(from var(--chart-1) l c h / ${o})` }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function StaleTracker({
  staleProjects,
  onSelect,
}: {
  staleProjects: Array<{ id: string; name: string; daysInactive: number; healthScore: number; status: string }>;
  onSelect: (id: string) => void;
}) {
  if (staleProjects.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {staleProjects.slice(0, 10).map((p) => {
        let color: string;
        let label: string;
        if (p.daysInactive > 60) {
          color = "text-red-500";
          label = "Dead";
        } else if (p.daysInactive > 30) {
          color = "text-red-400";
          label = "Stale";
        } else if (p.daysInactive > 14) {
          color = "text-amber-500";
          label = "Cooling";
        } else {
          color = "text-emerald-500";
          label = "Active";
        }
        return (
          <button
            key={p.id}
            type="button"
            className="w-full text-left flex items-center gap-3 py-1 hover:bg-muted/30 transition-colors rounded-md px-1"
            onClick={() => onSelect(p.id)}
          >
            <span className="text-xs font-medium min-w-[100px] max-w-[140px] truncate">{p.name}</span>
            <div className="flex-1" />
            <span className={cn("text-[11px] font-semibold tabular-nums", color)}>{p.daysInactive}d</span>
            <span className={cn("text-[10px] font-medium uppercase tracking-wider", color)}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function LanguageBreakdown({
  languages,
}: {
  languages: Array<{ language: string; count: number; weekCommits: number }>;
}) {
  if (languages.length === 0) return null;

  const data = languages.slice(0, 8).map((l) => ({
    language: l.language.length > 12 ? l.language.slice(0, 10) + "…" : l.language,
    weekCommits: l.weekCommits,
    count: l.count,
  }));

  return (
    <ChartContainer config={LANGUAGE_CONFIG} className="min-h-[200px] w-full">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis type="category" dataKey="language" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="weekCommits" fill="var(--color-weekCommits)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

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
  }, []);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const { totals, statusCounts, momentum, momentumProjects, signals, topActive, languages, staleProjects, weeklyCommitHistory, healthDistribution, dailyCommitCounts } = stats;

  const barData = topActive.slice(0, 8).map((p) => ({
    name: p.name.length > 14 ? p.name.slice(0, 12) + "…" : p.name,
    week: p.week,
    monthPrior: p.month - p.week,
    quarterPrior: Math.max(0, p.quarter - p.month),
  }));

  const pieData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_LABELS[status] ?? status,
      value: count,
      fill: STATUS_COLORS_MAP[status] ?? "#9ca3af",
    }));

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
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

      {/* ── Contribution Heatmap ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
          <Activity className="size-3.5 text-emerald-500" />
          <h3 className={SECTION_LABEL}>Contribution Rhythm</h3>
        </div>
        <div className="px-5 py-4">
          <ContributionHeatmap dailyCommitCounts={dailyCommitCounts} />
        </div>
      </div>

      {/* ── Commit Velocity + Trend (side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
            <BarChart3 className="size-3.5 text-blue-500" />
            <h3 className={SECTION_LABEL}>Commit Velocity</h3>
          </div>
          <div className="px-5 py-3">
            <ChartContainer config={VELOCITY_CHART_CONFIG} className="min-h-[180px] w-full">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="week" stackId="a" fill="var(--color-week)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="monthPrior" stackId="a" fill="var(--color-monthPrior)" />
                <Bar dataKey="quarterPrior" stackId="a" fill="var(--color-quarterPrior)" radius={[0, 0, 2, 2]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        {weeklyCommitHistory.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
              <TrendingUp className="size-3.5 text-chart-1" />
              <h3 className={SECTION_LABEL}>Commit Trend (12 weeks)</h3>
            </div>
            <div className="px-5 py-3">
              <ChartContainer config={COMMIT_TREND_CONFIG} className="min-h-[180px] w-full">
                <AreaChart data={weeklyCommitHistory} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v: string) => v.replace(/^\d{4}-W/, "W")}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-totalCommits)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-totalCommits)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="totalCommits" stroke="var(--color-totalCommits)" fill="url(#trendFill)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Momentum + Stale Tracker ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
            <Activity className="size-3.5 text-amber-500" />
            <h3 className={SECTION_LABEL}>Momentum</h3>
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
                            const p = projects.find((proj) => proj.name === name);
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

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
            <Clock className="size-3.5 text-red-400" />
            <h3 className={SECTION_LABEL}>Stale Tracker</h3>
          </div>
          <div className="px-5 py-3">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-emerald-500" /> Active (&lt;14d)</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-amber-500" /> Cooling (14-30d)</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-red-400" /> Stale (30-60d)</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-red-500" /> Dead (&gt;60d)</span>
            </div>
            <StaleTracker staleProjects={staleProjects} onSelect={onSelectProject} />
          </div>
        </div>
      </div>

      {/* ── Health Distribution Histogram + Portfolio Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
            <Heart className="size-3.5 text-red-400" />
            <h3 className={SECTION_LABEL}>Health Distribution</h3>
          </div>
          <div className="px-5 py-4">
            <ChartContainer config={HEALTH_HIST_CONFIG} className="min-h-[200px] w-full">
              <BarChart data={healthDistribution} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="range"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: string) => v.split("-")[0]}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
            <Layers className="size-3.5 text-purple-400" />
            <h3 className={SECTION_LABEL}>Portfolio Status</h3>
          </div>
          <div className="px-5 py-4">
            {pieData.length > 0 ? (
              <div className="flex items-start gap-4">
                <div className="min-w-[160px] min-h-[160px]">
                  <ChartContainer
                    config={Object.fromEntries(pieData.map((d) => [d.name.toLowerCase().replace(/\s/g, ""), { label: d.name, color: d.fill }]))}
                    className="min-h-[160px] w-[160px]"
                  >
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
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="size-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                      <span className="text-xs font-medium">{d.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No status data yet. Run an AI scan to see health distribution.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Language/Framework Breakdown ── */}
      {languages.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
              <Code2 className="size-3.5 text-chart-1" />
              <h3 className={SECTION_LABEL}>Languages</h3>
            </div>
            <div className="px-5 py-4">
              <LanguageBreakdown languages={languages} />
            </div>
          </div>

          {stats.frameworks && stats.frameworks.length > 0 && stats.frameworks.some((f) => f.framework !== "None detected") && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
                <Layers className="size-3.5 text-chart-2" />
                <h3 className={SECTION_LABEL}>Frameworks</h3>
              </div>
              <div className="px-5 py-4">
                <LanguageBreakdown languages={stats.frameworks.filter((f) => f.framework !== "None detected").map((f) => ({ language: f.framework, count: f.count, weekCommits: f.weekCommits }))} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Portfolio Allocation Treemap ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
          <Layers className="size-3.5 text-chart-1" />
          <h3 className={SECTION_LABEL}>Portfolio Allocation</h3>
        </div>
        <div className="px-5 py-4">
          <TreemapChart projects={projects} onSelect={onSelectProject} />
        </div>
      </div>

      {/* ── Lifecycle Timeline ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
          <GitMerge className="size-3.5 text-blue-400" />
          <h3 className={SECTION_LABEL}>Lifecycle Timeline</h3>
        </div>
        <div className="px-5 py-4">
          <LifecycleTimeline projects={projects} onSelect={onSelectProject} />
        </div>
      </div>

      {/* ── GitHub Signal Dashboard ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-2">
          <Github className="size-3.5" />
          <h3 className={SECTION_LABEL}>GitHub Signals</h3>
        </div>
        <div className="px-5 py-4">
          <GitHubSignals projects={projects} onSelect={onSelectProject} />
        </div>
      </div>

      <ShippedSection shipped={shipped} loading={shippedLoading} />
    </div>
  );
}