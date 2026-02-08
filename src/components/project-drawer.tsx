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
import { cn } from "@/lib/utils";

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
  children,
}: {
  title: string;
  source?: { type: "scan" | "llm"; timestamp: string | null };
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg p-4">
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
  return entries.slice(0, 15);
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
}: ProjectDrawerProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (!project?.id || !open) {
      setActivities([]);
      return;
    }
    fetch(`/api/projects/${project.id}/activity`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setActivities(data.activities);
      })
      .catch(() => {
        // Silently ignore activity fetch failures
      });
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

          {/* Line 3: Status/badges LEFT + Quick actions RIGHT */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusSelect
                value={project.status}
                onSave={(v) => onUpdateOverride(project.id, { statusOverride: v })}
              />
              <span className={cn("text-xl font-bold tabular-nums", healthColor(project.healthScore))}>
                {project.healthScore}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
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
              {framework && (
                <Badge variant="secondary" className="text-[10px]">
                  {framework}
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

          {/* Line 4: Last commit message */}
          {scan?.lastCommitMessage && (
            <div className="font-mono text-sm bg-muted/50 rounded px-2.5 py-1.5 text-foreground/80">
              {scan.lastCommitMessage}
            </div>
          )}

          {/* ── Section 1: Recommendations ── */}
          <SectionBox
            title="Recommendations"
            source={{ type: "llm", timestamp: project.llmGeneratedAt }}
          >
            {project.recommendations.length > 0 ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {project.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Run LLM enrichment to generate recommendations.
              </p>
            )}
          </SectionBox>

          {/* ── Section 2: Timeline ── */}
          <SectionBox title="Timeline">
            {timeline.length > 0 ? (
              <div className="space-y-1">
                {timeline.map((entry) => (
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
            ) : (
              <p className="text-sm text-muted-foreground italic">No activity yet.</p>
            )}
          </SectionBox>

          {/* ── Section 3: Details ── */}
          <SectionBox
            title="Details"
            source={{ type: "scan", timestamp: project.lastScanned }}
          >
            <div className="space-y-3">
              {framework && (
                <div>
                  <span className="text-xs text-muted-foreground">Frameworks</span>
                  <p className="text-sm">{framework}</p>
                </div>
              )}

              {scan?.languages?.detected && scan.languages.detected.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Languages</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {scan.languages.detected.map((lang) => (
                      <Badge key={lang} variant="secondary" className="text-[10px]">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {services && (
                <div>
                  <span className="text-xs text-muted-foreground">Services</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {services.map((svc) => (
                      <Badge key={svc} variant="secondary" className="text-[10px]">
                        {svc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {scan?.cicd && Object.values(scan.cicd).some(Boolean) && (
                <div>
                  <span className="text-xs text-muted-foreground">CI/CD</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {Object.entries(scan.cicd)
                      .filter(([, v]) => v)
                      .map(([k]) => (
                        <Badge key={k} variant="outline" className="text-[10px]">
                          {k}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              {scan?.deployment && Object.values(scan.deployment).some(Boolean) && (
                <div>
                  <span className="text-xs text-muted-foreground">Deploy</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {Object.entries(scan.deployment)
                      .filter(([, v]) => v)
                      .map(([k]) => (
                        <Badge key={k} variant="outline" className="text-[10px]">
                          {k}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              {project.liveUrl && (
                <div>
                  <span className="text-xs text-muted-foreground">Live URL</span>
                  <p className="text-sm">
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {project.liveUrl}
                    </a>
                  </p>
                </div>
              )}

              {loc != null && (
                <div>
                  <span className="text-xs text-muted-foreground">Lines of Code</span>
                  <p className="text-sm font-mono tabular-nums">{loc.toLocaleString()}</p>
                </div>
              )}

              {project.notableFeatures.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Features</span>
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

          {/* ── Section 4: Pitch ── */}
          <SectionBox
            title="Pitch"
            source={{ type: "llm", timestamp: project.llmGeneratedAt }}
          >
            {project.pitch ? (
              <p className="text-sm leading-relaxed">{project.pitch}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Run LLM enrichment to generate pitch.
              </p>
            )}
          </SectionBox>

          {/* ── Section 5: O-1 Evidence ── */}
          {featureO1 && (
            <SectionBox title="O-1 Evidence" source={{ type: "llm", timestamp: project.llmGeneratedAt }}>
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
            </SectionBox>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
