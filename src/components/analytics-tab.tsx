import { useState, useEffect } from "react";
import type { Project } from "@/lib/types";
import type { PortfolioStats } from "@/lib/merge";
import type { ShippedData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STATUS_COLORS_HEX } from "@/lib/status-colors";
import { SectionCard } from "@/components/ui/section-card";
import {
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Loader2,
  AlertCircle,
  GitBranch,
  Layers,
  GitMerge,
  ArrowUpRight,
  ArrowDownRight,
  Rocket,
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
import { LifecycleTimeline } from "@/components/lifecycle-timeline";

// ── Chart configs ───────────────────────────────────────────

const VELOCITY_CHART_CONFIG: ChartConfig = {
  week: { label: "This week", color: "var(--chart-1)" },
  monthPrior: { label: "Rest of month", color: "var(--chart-2)" },
  quarterPrior: { label: "Prior 60d", color: "var(--chart-3)" },
};

const COMMIT_TREND_CONFIG: ChartConfig = {
  totalCommits: { label: "Total commits", color: "var(--chart-1)" },
};

// ── Momentum config ────────────────────────────────────────

type Momentum = "accelerating" | "steady" | "decelerating" | "stalled";

const MOMENTUM_CONFIG: Record<Momentum, { icon: typeof TrendingUp; label: string; color: string; bg: string }> = {
  accelerating: { icon: TrendingUp, label: "Accelerating", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  steady: { icon: Minus, label: "Steady", color: "text-blue-400", bg: "bg-blue-500/10" },
  decelerating: { icon: TrendingDown, label: "Decelerating", color: "text-amber-500", bg: "bg-amber-500/10" },
  stalled: { icon: Clock, label: "Stalled", color: "text-muted-foreground", bg: "bg-muted" },
};

// ── Heatmap ────────────────────────────────────────────────

function computeHeatmapSummary(dailyCommitCounts: Record<string, number>) {
  const days = Object.keys(dailyCommitCounts).sort();
  if (days.length === 0) return { currentStreak: 0, longestStreak: 0, mostActiveDay: "" };

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let currentStreak = 0;
  const start = dailyCommitCounts[todayStr] && dailyCommitCounts[todayStr] > 0 ? today : dailyCommitCounts[yesterdayStr] && dailyCommitCounts[yesterdayStr] > 0 ? yesterday : null;
  if (start) {
    const d = new Date(start);
    while (true) {
      const key = d.toISOString().split("T")[0];
      if (dailyCommitCounts[key] && dailyCommitCounts[key] > 0) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
  }

  let longestStreak = 0;
  let run = 0;
  for (const day of days) {
    if (dailyCommitCounts[day] > 0) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayTotals = new Array(7).fill(0);
  for (const day of days) {
    const d = new Date(day);
    dayTotals[d.getDay()] += dailyCommitCounts[day];
  }
  const maxDay = dayTotals.indexOf(Math.max(...dayTotals));

  return { currentStreak, longestStreak, mostActiveDay: dayNames[maxDay] };
}

function ContributionHeatmap({ dailyCommitCounts }: { dailyCommitCounts: Record<string, number> }) {
  const days = Object.keys(dailyCommitCounts);
  if (days.length === 0) {
    return <p className="text-xs text-muted-foreground py-4">No commit history yet. Run a scan to see your activity pattern.</p>;
  }

  const maxCommits = Math.max(1, ...Object.values(dailyCommitCounts));
  const today = new Date();
  const WEEKS = 53;

  // Start from the Sunday that begins the week containing 53*7 days ago
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - (WEEKS * 7 - 1 + startDay.getDay()));
  startDay.setHours(0, 0, 0, 0);

  // Build a 7×53 grid: rows = day-of-week (Sun..Sat), cols = weeks
  // CSS grid fills row-by-row, so we must emit all 53 cells of row 0 first, then row 1, etc.
  const grid: Array<Array<{ date: string; count: number; isFuture: boolean }>> = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const row: Array<{ date: string; count: number; isFuture: boolean }> = [];
    for (let w = 0; w < WEEKS; w++) {
      const cellDate = new Date(startDay);
      cellDate.setDate(cellDate.getDate() + w * 7 + dayOfWeek);
      const dateStr = cellDate.toISOString().split("T")[0];
      const isFuture = cellDate > today;
      row.push({ date: dateStr, count: dailyCommitCounts[dateStr] ?? 0, isFuture });
    }
    grid.push(row);
  }

  // Month labels — use the Monday (dayOfWeek=1) of each week to detect month boundaries
  const monthLabels: Array<{ label: string; weekIdx: number }> = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const cellDate = new Date(startDay);
    cellDate.setDate(cellDate.getDate() + w * 7 + 1); // Monday
    const month = cellDate.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ label: cellDate.toLocaleString("en", { month: "short" }), weekIdx: w });
      lastMonth = month;
    }
  }

  function getContribLevel(count: number): number {
    if (count === 0) return 0;
    const ratio = count / maxCommits;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="heatmap-container">
      {/* Day-of-week labels */}
      <div className="heatmap-day-labels">
        {dayLabels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      <div className="heatmap-grid-wrapper">
        {/* Month labels — positioned by week fraction */}
        <div className="heatmap-month-labels">
          {monthLabels.map((ml, i) => (
            <span
              key={i}
              style={{ left: `${(ml.weekIdx / WEEKS) * 100}%` }}
            >
              {ml.label}
            </span>
          ))}
        </div>

        {/* CSS grid: 53 columns × 7 rows. Data is row-major (7 rows of 53 weeks each). */}
        <div
          className="heatmap-grid"
          style={{ '--weeks': WEEKS } as React.CSSProperties}
        >
          {grid.flatMap((row) =>
            row.map((day) => (
              <div
                key={day.date}
                className={cn("heatmap-cell", day.isFuture ? "" : `l${getContribLevel(day.count)}`)}
                title={`${day.date}: ${day.count} commit${day.count !== 1 ? "s" : ""}`}
              />
            ))
          )}
        </div>
      </div>

      <style>{`
        .heatmap-container {
          display: flex;
          gap: 6px;
        }
        .heatmap-day-labels {
          display: grid;
          grid-template-rows: repeat(7, minmax(0, 1fr));
          gap: 3px;
          width: 24px;
          flex-shrink: 0;
        }
        .heatmap-day-labels span {
          font-size: 9px;
          line-height: 1;
          color: hsl(var(--muted-foreground));
          display: flex;
          align-items: center;
        }
        .heatmap-grid-wrapper {
          flex: 1;
          min-width: 0;
        }
        .heatmap-month-labels {
          position: relative;
          height: 16px;
          margin-bottom: 6px;
        }
        .heatmap-month-labels span {
          position: absolute;
          font-size: 9px;
          color: hsl(var(--muted-foreground));
          line-height: 1;
        }
        .heatmap-grid {
          display: grid;
          grid-template-columns: repeat(var(--weeks), minmax(0, 1fr));
          grid-template-rows: repeat(7, minmax(0, 1fr));
          gap: 3px;
          width: 100%;
        }
        .heatmap-cell {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 2px;
          border: 1px solid hsl(var(--border) / 0.4);
          background: hsl(var(--background));
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .heatmap-cell:hover {
          z-index: 1;
          transform: scale(1.6);
          box-shadow: 0 2px 6px hsl(var(--foreground) / 0.12);
        }
        .heatmap-cell.l1 { background: oklch(from var(--chart-1) l c h / 0.3); border-color: oklch(from var(--chart-1) l c h / 0.15); }
        .heatmap-cell.l2 { background: oklch(from var(--chart-1) l c h / 0.5); border-color: oklch(from var(--chart-1) l c h / 0.25); }
        .heatmap-cell.l3 { background: oklch(from var(--chart-1) l c h / 0.75); border-color: oklch(from var(--chart-1) l c h / 0.35); }
        .heatmap-cell.l4 { background: oklch(from var(--chart-1) l c h / 1); border-color: oklch(from var(--chart-1) l c h / 0.5); }
      `}</style>
    </div>
  );
}

// ── Analytics Tab ──────────────────────────────────────────

interface AnalyticsTabProps {
  projects: Project[];
  shipped: ShippedData | null;
  shippedLoading: boolean;
  onSelectProject: (id: string) => void;
}

export function AnalyticsTab({
  projects,
  shipped,
  shippedLoading,
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

  const {
    totals,
    statusCounts,
    momentum,
    momentumProjects,
    signals,
    topActive,
    staleProjects,
    weeklyCommitHistory,
    dailyCommitCounts,
  } = stats;

  // ── Computed CTAs ──

  // Commit trend
  const lastWeekCommits = weeklyCommitHistory.length >= 2 ? weeklyCommitHistory[weeklyCommitHistory.length - 2].totalCommits : null;
  const commitDelta = lastWeekCommits !== null ? totals.weekCommits - lastWeekCommits : null;
  const commitDeltaPct = lastWeekCommits && lastWeekCommits > 0 ? Math.round(((totals.weekCommits - lastWeekCommits) / lastWeekCommits) * 100) : null;

  // Velocity CTA: which project dominates?
  const topProject = topActive[0];
  const topProjectShare = totals.quarterCommits > 0 && topProject ? Math.round((topProject.quarter / totals.quarterCommits) * 100) : 0;
  const velocityCta = topProjectShare > 40
    ? `${topProject!.name} accounts for ${topProjectShare}% of your commits — consider balancing.`
    : topProject
      ? `${topProject.name} leads with ${topProject.week} commits this week.`
      : null;

  // Momentum CTA
  const stalledCount = momentum.stalled;
  const decelCount = momentum.decelerating;
  const momentumCta = stalledCount > 0 && decelCount > 0
    ? `${stalledCount + decelCount} projects need attention — ${stalledCount} stalled, ${decelCount} decelerating.`
    : stalledCount > 0
      ? `${stalledCount} projects are stalled. Pick one to revive or archive it.`
      : decelCount > 0
        ? `${decelCount} projects are decelerating. Check in before they stall.`
        : "All projects have positive momentum.";

  // Stale CTA
  const staleCta = staleProjects.length > 0
    ? `${staleProjects.length} project${staleProjects.length !== 1 ? "s" : ""} inactive 14+ days — click to investigate.`
    : null;

  // Shipped CTA
  const shippedCta = shipped && !shippedLoading
    ? totals.weekCommits > 0
      ? `${shipped.weekTotal} commits this week — ${totals.weekCommits > (lastWeekCommits ?? totals.weekCommits) ? "up" : "track it"} week over week.`
      : "No commits this week. Time to write some code."
    : null;

  // Velocity chart data
  const barData = topActive.slice(0, 8).map((p) => ({
    name: p.name.length > 14 ? p.name.slice(0, 12) + "…" : p.name,
    week: p.week,
    monthPrior: p.month - p.week,
    quarterPrior: Math.max(0, p.quarter - p.month),
  }));

  // Status donut data
  const pieData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_COLORS_HEX[status] ? status.charAt(0).toUpperCase() + status.slice(1) : status,
      value: count,
      fill: STATUS_COLORS_HEX[status] ?? "#9ca3af",
    }));

  // Heatmap summary
  const heatmapSummary = computeHeatmapSummary(dailyCommitCounts);

  // Stale list for lifecycle section
  return (
    <div className="space-y-4">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{totals.projects}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Projects</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-emerald-500">{totals.weekCommits}</span>
            {commitDeltaPct !== null && commitDelta !== null && (
              <span className={cn("text-[11px] font-medium tabular-nums", commitDelta > 0 ? "text-emerald-500" : commitDelta < 0 ? "text-red-500" : "text-muted-foreground")}>
                {commitDelta > 0 ? <ArrowUpRight className="inline size-3" /> : commitDelta < 0 ? <ArrowDownRight className="inline size-3" /> : <Minus className="inline size-3" />}
                {" "}{Math.abs(commitDeltaPct)}%
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Commits this week</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-1.5">
            {signals.ciFailing > 0 && <AlertCircle className="size-3.5 text-red-500" />}
          </div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{signals.openIssues}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Open issues</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-1.5">
            {signals.ciFailing > 0 && <AlertCircle className="size-3.5 text-red-500" />}
            {signals.dirty > 0 && <GitBranch className="size-3.5 text-amber-500" />}
          </div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{signals.ciFailing + signals.dirty}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Needs attention</div>
        </div>
      </div>

      {/* ── Contribution Rhythm ── full width, no card padding constraint */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-3.5 text-emerald-500" />
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Contribution rhythm</h3>
          </div>
          {Object.keys(dailyCommitCounts).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {heatmapSummary.currentStreak > 0 && <span className="font-medium text-foreground">{heatmapSummary.currentStreak}-day streak</span>}
              {heatmapSummary.currentStreak > 0 && heatmapSummary.mostActiveDay && " · "}
              {heatmapSummary.mostActiveDay && <>Most active on {heatmapSummary.mostActiveDay}s</>}
              {heatmapSummary.currentStreak === 0 && !heatmapSummary.mostActiveDay && "Start a streak by committing today."}
            </p>
          )}
        </div>
        <div className="p-4">
          <ContributionHeatmap dailyCommitCounts={dailyCommitCounts} />
        </div>
      </div>

      {/* ── Commit Velocity + Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={<BarChart3 className="size-3.5 text-blue-500" />} title="Commit velocity" padded={false}>
          {velocityCta && (
            <p className="px-4 pt-1 text-xs text-muted-foreground">{velocityCta}</p>
          )}
          <div className="p-4">
            <ChartContainer config={VELOCITY_CHART_CONFIG} className="min-h-[180px] w-full">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="week" stackId="a" fill="var(--color-week)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="monthPrior" stackId="a" fill="var(--color-monthPrior)" />
                <Bar dataKey="quarterPrior" stackId="a" fill="var(--color-quarterPrior)" radius={[0, 0, 2, 2]} />
              </BarChart>
            </ChartContainer>
          </div>
        </SectionCard>

        {weeklyCommitHistory.length > 0 && (
          <SectionCard icon={<TrendingUp className="size-3.5 text-chart-1" />} title="Commit trend (12 weeks)" padded={false}>
            <p className="px-4 pt-1 text-xs text-muted-foreground">
              {commitDelta !== null
                ? commitDelta > 0
                  ? `Up ${Math.abs(commitDeltaPct ?? 0)}% from last week. Keep it up.`
                  : commitDelta < 0
                    ? `Down ${Math.abs(commitDeltaPct ?? 0)}% from last week. Try to ship something today.`
                    : "Same as last week. Push for one more commit."
                : "Track your weekly commit output over time."}
            </p>
            <div className="p-4">
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
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
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
          </SectionCard>
        )}
      </div>

      {/* ── Portfolio Health: Momentum + Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={<Activity className="size-3.5 text-amber-500" />} title="Momentum">
          {momentumCta && (
            <p className="text-xs text-muted-foreground mb-3">{momentumCta}</p>
          )}
          <div className="space-y-3">
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
        </SectionCard>

        <SectionCard icon={<Layers className="size-3.5 text-purple-400" />} title="Portfolio status">
          {pieData.length > 0 ? (
            <div className="flex items-start gap-4">
              <div className="min-w-[140px] min-h-[140px]">
                <ChartContainer
                  config={Object.fromEntries(pieData.map((d) => [d.name.toLowerCase().replace(/\s/g, ""), { label: d.name, color: d.fill }]))}
                  className="min-h-[140px] w-[140px]"
                >
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={64}
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
              <div className="flex-1 space-y-1.5 pt-2">
                {pieData.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    className="flex items-center gap-2 w-full text-left hover:bg-muted/30 rounded px-1 py-0.5 transition-colors"
                    onClick={() => {
                      // Find first project with this status to select
                      const status = d.name.toLowerCase();
                      const p = projects.find((proj) => (proj.llmStatus ?? proj.status) === status);
                      if (p) onSelectProject(p.id);
                    }}
                  >
                    <div className="size-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                    <span className="text-xs font-medium">{d.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{d.value}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No status data yet. Run an AI scan to see health distribution.</p>
          )}
        </SectionCard>
      </div>

      {/* ── Lifecycle + Shipped ── */}
      <SectionCard
        icon={<GitMerge className="size-3.5 text-blue-400" />}
        title="Lifecycle"
        action={
          !shippedLoading && shipped ? (
            <div className="flex items-center gap-3 text-[11px] tabular-nums">
              <Rocket className="size-3 text-emerald-500" />
              <span className="font-semibold text-foreground">{shipped.weekTotal}</span>
              <span className="text-muted-foreground">7d</span>
              <span className="font-semibold text-foreground">{shipped.monthTotal}</span>
              <span className="text-muted-foreground">30d</span>
              <span className="font-semibold text-foreground">{shipped.quarterTotal}</span>
              <span className="text-muted-foreground">90d</span>
            </div>
          ) : null
        }
        padded={false}
      >
        {shippedCta && (
          <p className="px-4 pt-1 text-xs text-muted-foreground">{shippedCta}</p>
        )}
        {staleCta && (
          <p className="px-4 pt-0.5 text-xs text-muted-foreground">{staleCta}</p>
        )}
        <div className="p-4">
          <LifecycleTimeline projects={projects} onSelect={onSelectProject} />
        </div>
      </SectionCard>
    </div>
  );
}