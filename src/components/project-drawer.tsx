"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VsCodeIcon, ClaudeIcon, CodexIcon, TerminalIcon, PinIcon } from "@/components/project-icons";
import { healthColor, copyToClipboard, formatRelativeDate } from "@/lib/project-helpers";
import { evaluateAttention } from "@/lib/attention";
import { cn } from "@/lib/utils";
import type { ProjectDelta } from "@/hooks/use-refresh-deltas";

/* ── Constants ─────────────────────────────────────────── */

const VALID_STATUSES = ["active", "paused", "stale", "archived"] as const;

/* ── Components ────────────────────────────────────────── */

function StatusSelect({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onSave(e.target.value)}
      className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {VALID_STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function SectionBox({
  title,
  source,
  highlight,
  children,
}: {
  title: string;
  source?: { type: "scan" | "llm"; timestamp: string | null };
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border border-border rounded-lg p-4", highlight && "border-l-2 border-l-amber-400")}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {source && (
          <span className="text-[10px] text-muted-foreground">
            {source.type} · {source.timestamp ? formatRelativeDate(source.timestamp) : "\u2014"}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  source,
  highlight,
  defaultOpen = true,
  children,
}: {
  title: string;
  source?: { type: "scan" | "llm"; timestamp: string | null };
  highlight?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("border border-border rounded-lg", highlight && "border-l-2 border-l-amber-400")}>
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
          {source && (
            <span className="text-[10px] text-muted-foreground">
              {source.type} · {source.timestamp ? formatRelativeDate(source.timestamp) : "\u2014"}
            </span>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12"
          className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
          fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="space-y-1.5">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-medium text-muted-foreground capitalize">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </dt>
          <dd className="text-sm mt-0.5">
            {Array.isArray(value) ? (
              <ul className="list-disc list-inside space-y-0.5">
                {value.map((item, i) => (
                  <li key={i}>{String(item)}</li>
                ))}
              </ul>
            ) : typeof value === "object" && value !== null ? (
              <div className="pl-3 border-l-2 border-muted mt-1">
                <StructuredData data={value as Record<string, unknown>} />
              </div>
            ) : (
              <span>{String(value)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Activity Types & Helpers ──────────────────────────── */

interface ActivityEntry {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  scan: "Scanned",
  llm: "LLM enriched",
  override: "Override updated",
  metadata: "Metadata updated",
  pin: "Pinned/Unpinned",
  opened: "Opened",
};

function activityLabel(entry: ActivityEntry): string {
  if (entry.type === "opened" && entry.payload?.tool) {
    const toolNames: Record<string, string> = {
      vscode: "VS Code",
      claude: "Claude",
      codex: "Codex",
      terminal: "Terminal",
    };
    return `Opened in ${toolNames[entry.payload.tool as string] ?? entry.payload.tool}`;
  }
  if (entry.type === "pin" && entry.payload) {
    return entry.payload.pinned ? "Pinned" : "Unpinned";
  }
  return ACTIVITY_LABELS[entry.type] ?? entry.type;
}

/* ── Timeline Helpers ──────────────────────────────────── */

interface TimelineEntry {
  key: string;
  type: "git" | "scan" | "llm" | "user" | "pin" | string;
  description: string;
  date: string;
}

const TIMELINE_BADGE_CLASSES: Record<string, string> = {
  git: "bg-zinc-100 text-zinc-600",
  scan: "bg-blue-100 text-blue-700",
  llm: "bg-purple-100 text-purple-700",
  user: "bg-emerald-100 text-emerald-700",
  pin: "bg-amber-100 text-amber-700",
};

function activityToTimelineType(entryType: string): string {
  if (entryType === "llm") return "llm";
  if (entryType === "opened") return "user";
  if (entryType === "pin") return "pin";
  return entryType;
}

/** Scan/scan+llm activities are excluded — shown as "last scanned" in Details instead. */
const TIMELINE_EXCLUDED_TYPES = new Set(["scan", "scan+llm"]);

function buildTimeline(
  commits: Array<{ hash: string; message: string; date: string }>,
  activities: ActivityEntry[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const c of commits) {
    entries.push({
      key: `git-${c.hash}`,
      type: "git",
      description: c.message,
      date: c.date,
    });
  }

  for (const a of activities) {
    if (TIMELINE_EXCLUDED_TYPES.has(a.type)) continue;
    entries.push({
      key: `act-${a.id}`,
      type: activityToTimelineType(a.type),
      description: activityLabel(a),
      date: a.createdAt,
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return entries;
}

/* ── Drawer Props ──────────────────────────────────────── */

interface ProjectDrawerProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onUpdateOverride: (id: string, fields: Record<string, unknown>) => Promise<unknown>;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  featureO1?: boolean;
  sanitizePaths?: boolean;
  delta?: ProjectDelta | null;
}

/* ── Main Drawer ───────────────────────────────────────── */

export function ProjectDrawer({
  project,
  open,
  onClose,
  onUpdateOverride,
  onTogglePin,
  onTouch,
  featureO1,
  sanitizePaths,
  delta,
}: ProjectDrawerProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [timelinePage, setTimelinePage] = useState(0);
  const [activityProjectId, setActivityProjectId] = useState<string | null>(null);

  // Track project changes to reset state outside the fetch effect
  const currentProjectId = project?.id ?? null;
  if (currentProjectId !== activityProjectId) {
    setActivityProjectId(currentProjectId);
    setActivities([]);
    setTimelinePage(0);
  }

  useEffect(() => {
    if (!project?.id || !open) return;
    let cancelled = false;
    fetch(`/api/projects/${project.id}/activity`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setActivities(data.activities);
      })
      .catch(() => {
        // Silently ignore activity fetch failures
      });
    return () => { cancelled = true; };
  }, [project?.id, open]);

  if (!project) return null;

  const scan = project.scan;
  const rawPath = project.pathDisplay;
  const framework = project.framework ?? scan?.languages?.primary ?? null;
  const branchName = project.branchName ?? scan?.branch ?? null;
  const loc = project.locEstimate || null;
  const services = project.services.length > 0 ? project.services : null;
  const timeline = buildTimeline(project.recentCommits, activities);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          {/* Line 1: Name + Pin */}
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg leading-tight">{project.name}</DialogTitle>
            <button
              type="button"
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded transition-colors shrink-0",
                project.pinned
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70"
              )}
              title={project.pinned ? "Unpin project" : "Pin project"}
              onClick={() => onTogglePin(project.id)}
            >
              <PinIcon filled={project.pinned} className="size-4" />
            </button>
          </div>

          {/* Line 2: Path */}
          <p className="text-xs text-muted-foreground font-mono truncate">{rawPath}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">

          {/* Line 3: Status/scores LEFT + Quick actions RIGHT */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusSelect
                value={project.status}
                onSave={(v) => onUpdateOverride(project.id, { statusOverride: v })}
              />
              <div className="flex items-center gap-1.5" title={`Hygiene ${project.hygieneScore} / Momentum ${project.momentumScore}`}>
                <span className={cn("text-sm font-bold tabular-nums", healthColor(project.hygieneScore))}>
                  {project.hygieneScore}
                </span>
                <span className="text-[10px] text-muted-foreground">hyg</span>
                <span className="text-muted-foreground/40">/</span>
                <span className={cn("text-sm font-bold tabular-nums", healthColor(project.momentumScore))}>
                  {project.momentumScore}
                </span>
                <span className="text-[10px] text-muted-foreground">mom</span>
              </div>
              {project.isDirty && (
                <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  dirty
                </Badge>
              )}
              {project.ahead != null && project.ahead > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  ↑{project.ahead}
                </Badge>
              )}
              {project.behind != null && project.behind > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  ↓{project.behind}
                </Badge>
              )}
              {branchName && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {branchName}
                </Badge>
              )}
            </div>

            {!sanitizePaths && (
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-[#007ACC] hover:bg-[#007ACC]/10"
                  title="Open in VS Code (v)"
                  asChild
                >
                  <a href={`vscode://file${encodeURI(rawPath)}`} onClick={() => onTouch(project.id, "vscode")}>
                    <VsCodeIcon className="size-4" />
                  </a>
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-[#D97757] hover:bg-[#D97757]/10"
                  title="Copy Claude command (c)"
                  onClick={() => { copyToClipboard(`cd "${rawPath}" && claude`, "Claude"); onTouch(project.id, "claude"); }}
                >
                  <ClaudeIcon className="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  title="Copy Codex command (x)"
                  onClick={() => { copyToClipboard(`cd "${rawPath}" && codex`, "Codex"); onTouch(project.id, "codex"); }}
                >
                  <CodexIcon className="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  title="Copy terminal cd command (t)"
                  onClick={() => { copyToClipboard(`cd "${rawPath}"`, "Terminal"); onTouch(project.id, "terminal"); }}
                >
                  <TerminalIcon className="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-muted-foreground"
                  title="Copy path"
                  onClick={() => copyToClipboard(rawPath, "path")}
                >
                  <span className="text-[10px]">Copy</span>
                </Button>
              </div>
            )}
          </div>

          {/* Attention banner */}
          {(() => {
            const attention = evaluateAttention(project);
            if (!attention.needsAttention) return null;
            return (
              <div className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                attention.severity === "high" ? "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900" :
                attention.severity === "med" ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900" :
                "bg-zinc-50 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800"
              )}>
                <span className="text-xs font-medium">Needs Attention</span>
                <span className="text-xs text-muted-foreground">&mdash;</span>
                <span className="text-xs">{attention.reasons[0].label}</span>
                {attention.reasons.length > 1 && (
                  <span className="text-[10px] text-muted-foreground">+{attention.reasons.length - 1} more</span>
                )}
              </div>
            );
          })()}

          {/* Line 4: Last commit message */}
          {scan?.lastCommitMessage && (
            <div className="font-mono text-sm bg-muted/50 rounded px-2.5 py-1.5 text-foreground/80">
              {scan.lastCommitMessage}
            </div>
          )}

          {/* ── Section 1: Pitch ── */}
          <SectionBox
            title="Pitch"
            source={{ type: "llm", timestamp: project.llmGeneratedAt }}
            highlight={delta?.newlyEnriched}
          >
            {project.pitch ? (
              <p className="text-sm leading-relaxed">{project.pitch}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Run LLM enrichment to generate pitch.
              </p>
            )}
          </SectionBox>

          {/* ── Section 2: Details (compressed) ── */}
          <SectionBox
            title="Details"
            source={{ type: "scan", timestamp: project.lastScanned }}
          >
            <div className="space-y-3">
              {/* 4-column grid: Framework, Languages, Services, LOC */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Framework</span>
                  <p className="text-sm mt-0.5">{framework ?? "\u2014"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Languages</span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {scan?.languages?.detected?.length ? scan.languages.detected.map((lang) => (
                      <Badge key={lang} variant="secondary" className="text-[9px] px-1 py-0">{lang}</Badge>
                    )) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Services</span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {services ? services.map((svc) => (
                      <Badge key={svc} variant="secondary" className="text-[9px] px-1 py-0">{svc}</Badge>
                    )) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">LOC</span>
                  <p className="text-sm font-mono tabular-nums mt-0.5">{loc != null ? loc.toLocaleString() : "\u2014"}</p>
                </div>
              </div>

              {/* CI/CD + Deploy + Live URL in a row if present */}
              {(scan?.cicd && Object.values(scan.cicd).some(Boolean)) ||
               (scan?.deployment && Object.values(scan.deployment).some(Boolean)) ||
               project.liveUrl ? (
                <div className="flex flex-wrap gap-3">
                  {scan?.cicd && Object.values(scan.cicd).some(Boolean) && (
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">CI/CD</span>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {Object.entries(scan.cicd).filter(([, v]) => v).map(([k]) => (
                          <Badge key={k} variant="outline" className="text-[9px] px-1 py-0">{k}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {scan?.deployment && Object.values(scan.deployment).some(Boolean) && (
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Deploy</span>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {Object.entries(scan.deployment).filter(([, v]) => v).map(([k]) => (
                          <Badge key={k} variant="outline" className="text-[9px] px-1 py-0">{k}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {project.liveUrl && (
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Live</span>
                      <p className="text-sm mt-0.5">
                        <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                          {project.liveUrl}
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Features */}
              {project.notableFeatures.length > 0 && (
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Features</span>
                  <ul className="list-disc list-inside text-sm space-y-0.5 mt-0.5">
                    {project.notableFeatures.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {scan?.commitCount != null && scan.commitCount > 0 && (
                <div className="text-[10px] text-muted-foreground pt-1">
                  {scan.commitCount} commits
                </div>
              )}
            </div>
          </SectionBox>

          {/* ── Section 3: Timeline ── */}
          <SectionBox title="Timeline">
            {timeline.length > 0 ? (() => {
              const ITEMS_PER_PAGE = 10;
              const totalPages = Math.ceil(timeline.length / ITEMS_PER_PAGE);
              const pageItems = timeline.slice(timelinePage * ITEMS_PER_PAGE, (timelinePage + 1) * ITEMS_PER_PAGE);

              return (
                <>
                  <div className="space-y-1">
                    {pageItems.map((entry) => (
                      <div key={entry.key} className="flex items-center gap-2 text-sm py-0.5">
                        <span
                          className={cn(
                            "text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0",
                            TIMELINE_BADGE_CLASSES[entry.type] ?? "bg-zinc-100 text-zinc-600"
                          )}
                        >
                          {entry.type}
                        </span>
                        <span className="text-foreground/80 truncate">{entry.description}</span>
                        <span className="text-muted-foreground shrink-0 ml-auto tabular-nums text-xs">
                          {formatRelativeDate(entry.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-3">
                      <button
                        type="button"
                        className="text-xs px-1.5 py-0.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                        disabled={timelinePage === 0}
                        onClick={() => setTimelinePage((p) => p - 1)}
                      >
                        &lt;
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            i === timelinePage
                              ? "bg-foreground text-background font-semibold"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                          onClick={() => setTimelinePage(i)}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="text-xs px-1.5 py-0.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                        disabled={timelinePage === totalPages - 1}
                        onClick={() => setTimelinePage((p) => p + 1)}
                      >
                        &gt;
                      </button>
                    </div>
                  )}
                </>
              );
            })() : (
              <p className="text-sm text-muted-foreground italic">No activity yet.</p>
            )}
          </SectionBox>

          {/* ── Section 4: AI Insights + Recommendations (merged) ── */}
          <CollapsibleSection
            title="AI Insights"
            source={{ type: "llm", timestamp: project.llmGeneratedAt }}
            highlight={delta?.newlyEnriched}
            defaultOpen={true}
          >
            {project.aiInsight ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tabular-nums">{project.aiInsight.score}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px]",
                      project.aiInsight.confidence === "high" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
                      project.aiInsight.confidence === "medium" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                      project.aiInsight.confidence === "low" && "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                    )}
                  >
                    {project.aiInsight.confidence} confidence
                  </Badge>
                </div>

                {project.aiInsight.reasons.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Reasons</span>
                    <ul className="list-disc list-inside text-sm space-y-0.5 mt-0.5">
                      {project.aiInsight.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {project.aiInsight.risks.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Risks</span>
                    <ul className="list-disc list-inside text-sm space-y-0.5 mt-0.5">
                      {project.aiInsight.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-md bg-muted p-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Next Best Action</span>
                  <p className="text-sm font-medium mt-0.5">{project.aiInsight.nextBestAction}</p>
                </div>
              </div>
            ) : project.recommendations.length > 0 ? (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Recommendations</span>
                <ul className="list-disc list-inside text-sm space-y-1 mt-0.5">
                  {project.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Run LLM enrichment to generate insights.
              </p>
            )}

            {/* Show recommendations below AI insight when both exist */}
            {project.aiInsight && project.recommendations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-xs font-medium text-muted-foreground">Recommendations</span>
                <ul className="list-disc list-inside text-sm space-y-1 mt-0.5">
                  {project.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleSection>

          {/* ── Section 5: O-1 Evidence ── */}
          {featureO1 && (
            <CollapsibleSection title="O-1 Evidence" source={{ type: "llm", timestamp: project.llmGeneratedAt }} highlight={delta?.newlyEnriched} defaultOpen={false}>
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Evidence</span>
                  {project.evidence && Object.keys(project.evidence).length > 0 ? (
                    <div className="rounded-md bg-muted p-2.5 mt-1">
                      <StructuredData data={project.evidence} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic mt-0.5">
                      No evidence data.
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-xs font-medium text-muted-foreground">Outcomes</span>
                  {project.outcomes && Object.keys(project.outcomes).length > 0 ? (
                    <div className="rounded-md bg-muted p-2.5 mt-1">
                      <StructuredData data={project.outcomes} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic mt-0.5">
                      No outcomes data.
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleSection>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
