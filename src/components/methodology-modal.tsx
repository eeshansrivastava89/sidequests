"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MethodologyModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80vw] w-full max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Methodology</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1: How It Works */}
            <div className="rounded-lg bg-muted/50 p-5 space-y-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How It Works
              </h3>

              <Step n={1} title="Scan">
                Python pipeline discovers git repos in your dev root, collects
                git status, languages, dependencies, CI/CD config, and LOC.
              </Step>

              <Step n={2} title="Derive">
                Deterministic scoring computes Hygiene and Momentum scores,
                status classification, and attention flags. No AI involved.
              </Step>

              <Step n={3} title="Enrich (Optional)">
                LLM generates a pitch, recommendations, AI insights, and
                confidence scores. Skipped for unchanged projects.
              </Step>

              <Step n={4} title="Merge & Display">
                Data merges by priority: Override &gt; Metadata &gt; Derived
                &gt; LLM &gt; Scan. Manual overrides are never lost.
              </Step>
            </div>

            {/* Column 2: Scoring */}
            <div className="rounded-lg bg-muted/50 p-5 space-y-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Scoring
              </h3>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2">
                  Hygiene (0–100)
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Structural health — slow-moving signals
                </p>
                <dl className="space-y-1 text-sm">
                  <Metric label="Tests present" value="+20" />
                  <Metric label="README" value="+15" />
                  <Metric label="CI/CD configured" value="+15" />
                  <Metric label="Remote configured" value="+10" />
                  <Metric label="Low TODOs (<10)" value="+10" />
                  <Metric label="Deployment config" value="+10" />
                  <Metric label="Linter config" value="+5" />
                  <Metric label="License" value="+5" />
                  <Metric label="Lockfile" value="+5" />
                </dl>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2">
                  Momentum (0–100)
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Operational velocity — fast-moving signals
                </p>
                <dl className="space-y-1 text-sm">
                  <Metric label="Commit ≤7d" value="+25" />
                  <Metric label="Commit ≤14d" value="+20" />
                  <Metric label="Commit ≤30d" value="+15" />
                  <Metric label="Clean working tree" value="+20" />
                  <Metric label="Pushed up (ahead=0)" value="+15" />
                  <Metric label="≤3 branches" value="+10" />
                </dl>
              </div>

              <div className="pt-2 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider mb-1">
                  Combined Health
                </h4>
                <p className="text-sm font-mono">
                  round(0.65 × hygiene + 0.35 × momentum)
                </p>
              </div>
            </div>

            {/* Column 3: Status & Attention */}
            <div className="rounded-lg bg-muted/50 p-5 space-y-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status & Attention
              </h3>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2">
                  Status Rules
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Based on days since last commit
                </p>
                <div className="space-y-2">
                  <StatusCard
                    color="bg-emerald-500"
                    label="Active"
                    rule="≤14 days"
                  />
                  <StatusCard
                    color="bg-blue-500"
                    label="Paused"
                    rule="15–60 days"
                  />
                  <StatusCard
                    color="bg-amber-500"
                    label="Stale"
                    rule="61–180 days"
                  />
                  <StatusCard
                    color="bg-zinc-400"
                    label="Archived"
                    rule=">180 days"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2">
                  Attention Flags
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Projects flagged when any rule triggers
                </p>
                <div className="space-y-1.5 text-sm">
                  <AttentionRule severity="high" label="Hygiene < 30" />
                  <AttentionRule severity="high" label="Inactive >30d, no next action" />
                  <AttentionRule severity="med" label="Momentum < 25" />
                  <AttentionRule severity="med" label="Dirty tree >7 days" />
                  <AttentionRule severity="low" label="Unpushed commits >7 days" />
                  <AttentionRule severity="low" label="20+ TODOs" />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2">
                  Merge Priority
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Highest wins — manual overrides are never lost
                </p>
                <ol className="space-y-1 text-sm list-decimal list-inside">
                  <li><span className="font-medium">Override</span> — manual UI edits</li>
                  <li><span className="font-medium">Metadata</span> — workflow fields</li>
                  <li><span className="font-medium">Derived</span> — deterministic scores</li>
                  <li><span className="font-medium">LLM</span> — AI-generated</li>
                  <li><span className="font-medium">Scan</span> — raw filesystem data</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Sub-components ── */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex items-center justify-center size-7 rounded-full bg-amber-500 text-white text-xs font-bold shrink-0">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-medium">{value}</span>
    </div>
  );
}

function StatusCard({ color, label, rule }: { color: string; label: string; rule: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
      <span className={`size-2.5 rounded-full ${color} shrink-0`} />
      <span className="text-sm font-medium flex-1">{label}</span>
      <span className="text-xs text-muted-foreground">{rule}</span>
    </div>
  );
}

function AttentionRule({ severity, label }: { severity: "high" | "med" | "low"; label: string }) {
  const colors = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    med: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${colors[severity]}`}>
        {severity}
      </span>
      <span>{label}</span>
    </div>
  );
}
