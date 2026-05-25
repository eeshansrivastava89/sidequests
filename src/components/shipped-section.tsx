import type { ShippedData } from "@/lib/types";
import { SectionCard } from "@/components/ui/section-card";
import { Rocket, TrendingUp } from "lucide-react";

interface ShippedSectionProps {
  shipped: ShippedData | null;
  loading: boolean;
}

const PERIODS = [
  { key: "week", label: "7d", field: "weekTotal" as const },
  { key: "month", label: "30d", field: "monthTotal" as const },
  { key: "quarter", label: "90d", field: "quarterTotal" as const },
];

export function ShippedSection({ shipped, loading }: ShippedSectionProps) {
  if (loading) {
    return (
      <SectionCard icon={<Rocket className="size-3.5 text-emerald-500" />} title="Shipped">
        <div className="animate-pulse space-y-2">
          <div className="h-3.5 w-16 bg-muted rounded" />
          <div className="h-6 w-full bg-muted rounded" />
        </div>
      </SectionCard>
    );
  }

  if (!shipped) return null;

  const topProjects = [...shipped.projects]
    .filter((p) => p.quarterCommits > 0)
    .sort((a, b) => b.quarterCommits - a.quarterCommits)
    .slice(5);

  return (
    <SectionCard icon={<Rocket className="size-3.5 text-emerald-500" />} title="Shipped">
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          {PERIODS.map((period) => (
            <div key={period.key} className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums">{shipped[period.field]}</span>
              <span className="text-[11px] text-muted-foreground">{period.label}</span>
            </div>
          ))}
        </div>

        {topProjects.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="size-3" />
              Top (90d)
            </div>
            {topProjects.map((p) => {
              const maxCommits = topProjects[0]?.quarterCommits ?? 1;
              const pct = Math.round((p.quarterCommits / maxCommits) * 100);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium min-w-[80px] truncate">{p.name}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: `oklch(from var(--chart-2) l c h / 0.7)`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{p.quarterCommits}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}