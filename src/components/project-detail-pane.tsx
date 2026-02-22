"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VsCodeIcon, ClaudeIcon, CodexIcon, TerminalIcon, PinIcon } from "@/components/project-icons";
import { copyToClipboard, formatRelativeDate, formatRelativeTime, parseGitHubOwnerRepo } from "@/lib/project-helpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { X, ExternalLink } from "lucide-react";

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

function SectionCard({
  title,
  sourceLabel,
  children,
}: {
  title: string;
  sourceLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-3 bg-card border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {sourceLabel && (
          <span className="text-xs text-muted-foreground">{sourceLabel}</span>
        )}
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
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

const TIMELINE_TYPE_CLASSES: Record<string, string> = {
  git: "text-muted-foreground",
  scan: "text-blue-500",
  llm: "text-purple-500",
  user: "text-emerald-500",
  pin: "text-amber-500",
};

function activityToTimelineType(entryType: string): string {
  if (entryType === "llm") return "llm";
  if (entryType === "opened") return "user";
  if (entryType === "pin") return "pin";
  return entryType;
}

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

/* ── GitHub helpers ────────────────────────────────────── */

function CiStatusLabel({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <span className="text-emerald-500 font-medium">Passing</span>;
    case "failure":
      return <span className="text-red-500 font-medium">Failing</span>;
    case "pending":
      return <span className="text-amber-500 font-medium">Pending</span>;
    default:
      return <span className="text-muted-foreground">None</span>;
  }
}

function parseJsonList(json: string | null): Array<{ title: string; number: number }> {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


/* ── Props ─────────────────────────────────────────────── */

export interface ProjectDetailPaneProps {
  project: Project;
  onClose: () => void;
  onUpdateOverride: (id: string, fields: Record<string, unknown>) => Promise<unknown>;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  sanitizePaths?: boolean;
  delta?: { newlyEnriched?: boolean } | null;
}

/* ── Main Component ────────────────────────────────────── */

export function ProjectDetailPane({
  project,
  onClose,
  onUpdateOverride,
  onTogglePin,
  onTouch,
  sanitizePaths,
  delta,
}: ProjectDetailPaneProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [timelinePage, setTimelinePage] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  const changeTimelinePage = useCallback((page: number) => {
    setTimelinePage(page);
    // After state update, scroll the timeline card header into view
    requestAnimationFrame(() => {
      timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  // Fetch activity when project changes (state resets via key prop on mount)
  useEffect(() => {
    if (!project.id) return;
    let cancelled = false;
    fetch(`/api/projects/${project.id}/activity`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setActivities(data.activities);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [project.id]);

  const scan = project.scan;
  const rawPath = project.pathDisplay;
  const framework = project.framework ?? project.primaryLanguage ?? null;
  const branchName = project.branchName ?? scan?.branch ?? null;
  const loc = project.locEstimate || null;
  const services = project.services.length > 0 ? project.services : null;
  const timeline = buildTimeline(project.recentCommits, activities);
  const hasGitHub = project.repoVisibility !== "not-on-github";
  const issues = parseJsonList(project.issuesTopJson);
  const prs = parseJsonList(project.prsTopJson);
  const ownerRepo = parseGitHubOwnerRepo(scan?.remoteUrl);
  const repoBaseUrl = ownerRepo ? `https://github.com/${ownerRepo.owner}/${ownerRepo.repo}` : null;
  const issuesUrl = repoBaseUrl ? `${repoBaseUrl}/issues` : null;
  const prsUrl = repoBaseUrl ? `${repoBaseUrl}/pulls` : null;
  const actionsUrl = repoBaseUrl ? `${repoBaseUrl}/actions` : null;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold leading-tight truncate">{project.name}</h2>
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
          <button
            type="button"
            className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            onClick={onClose}
            aria-label="Close detail pane"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <p className="text-sm text-muted-foreground font-mono truncate">{rawPath}</p>
          <span className="text-sm text-muted-foreground">&middot;</span>
          <span className="text-sm text-muted-foreground">
            Active {formatRelativeTime(project.lastTouchedAt ?? scan?.lastCommitDate ?? "")}
          </span>
          {repoBaseUrl && (
            <>
              <span className="text-sm text-muted-foreground">&middot;</span>
              <a
                href={repoBaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                <ExternalLink className="size-3" />
                GitHub
              </a>
            </>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Status + badges + Quick actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusSelect
              value={project.status}
              onSave={(v) => {
                onUpdateOverride(project.id, { statusOverride: v })
                  .then((d) => {
                    if ((d as { ok?: boolean })?.ok) toast.success(`Status → ${v}`);
                    else toast.error("Failed to update status");
                  })
                  .catch(() => toast.error("Failed to update status"));
              }}
            />
            {project.isDirty && (
              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                uncommitted
              </Badge>
            )}
            {project.ahead != null && project.ahead > 0 && (
              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30" title={`${project.ahead} commits ahead of remote`}>
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
        </div>

        {/* Last commit message */}
        {scan?.lastCommitMessage && (
          <div className="font-mono text-sm bg-card rounded-lg px-4 py-3 text-foreground/80">
            {scan.lastCommitMessage}
          </div>
        )}

        {/* ── GitHub Card ── */}
        {hasGitHub && (
          <SectionCard
            title="GitHub"
            sourceLabel={project.githubFetchedAt ? `Synced ${formatRelativeDate(project.githubFetchedAt)}` : undefined}
          >
            <div className="space-y-4">
              {/* Metric tiles — clickable links */}
              <div className="grid grid-cols-4 gap-3">
                {issuesUrl ? (
                  <a href={issuesUrl} target="_blank" rel="noopener noreferrer" className="group rounded-lg bg-card px-3 py-3 text-center cursor-pointer hover:bg-muted hover:ring-1 hover:ring-ring transition-colors">
                    <div className="text-xl font-bold">{project.openIssues}</div>
                    <div className="text-xs text-muted-foreground mt-1 group-hover:underline">Issues</div>
                  </a>
                ) : (
                  <div className="rounded-lg bg-card px-3 py-3 text-center">
                    <div className="text-xl font-bold">{project.openIssues}</div>
                    <div className="text-xs text-muted-foreground mt-1">Issues</div>
                  </div>
                )}
                {prsUrl ? (
                  <a href={prsUrl} target="_blank" rel="noopener noreferrer" className="group rounded-lg bg-card px-3 py-3 text-center cursor-pointer hover:bg-muted hover:ring-1 hover:ring-ring transition-colors">
                    <div className="text-xl font-bold">{project.openPrs}</div>
                    <div className="text-xs text-muted-foreground mt-1 group-hover:underline">PRs</div>
                  </a>
                ) : (
                  <div className="rounded-lg bg-card px-3 py-3 text-center">
                    <div className="text-xl font-bold">{project.openPrs}</div>
                    <div className="text-xs text-muted-foreground mt-1">PRs</div>
                  </div>
                )}
                {actionsUrl ? (
                  <a href={actionsUrl} target="_blank" rel="noopener noreferrer" className="group rounded-lg bg-card px-3 py-3 text-center cursor-pointer hover:bg-muted hover:ring-1 hover:ring-ring transition-colors">
                    <div className="text-xl font-bold"><CiStatusLabel status={project.ciStatus} /></div>
                    <div className="text-xs text-muted-foreground mt-1 group-hover:underline">CI Status</div>
                  </a>
                ) : (
                  <div className="rounded-lg bg-card px-3 py-3 text-center">
                    <div className="text-xl font-bold"><CiStatusLabel status={project.ciStatus} /></div>
                    <div className="text-xs text-muted-foreground mt-1">CI Status</div>
                  </div>
                )}
                {repoBaseUrl ? (
                  <a href={repoBaseUrl} target="_blank" rel="noopener noreferrer" className="group rounded-lg bg-card px-3 py-3 text-center cursor-pointer hover:bg-muted hover:ring-1 hover:ring-ring transition-colors">
                    <div className="text-xl font-bold">
                      {project.repoVisibility === "public" ? (
                        <span className="text-emerald-500">Public</span>
                      ) : project.repoVisibility === "private" ? (
                        <span className="text-amber-500">Private</span>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 group-hover:underline">Visibility</div>
                  </a>
                ) : (
                  <div className="rounded-lg bg-card px-3 py-3 text-center">
                    <div className="text-xl font-bold text-muted-foreground">{"\u2014"}</div>
                    <div className="text-xs text-muted-foreground mt-1">Visibility</div>
                  </div>
                )}
              </div>

              {/* Issue links */}
              {issues.length > 0 && (
                <div className="space-y-1.5">
                  {issues.map((issue) => (
                    <div key={issue.number} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs shrink-0 text-muted-foreground">#{issue.number}</span>
                      {repoBaseUrl ? (
                        <a
                          href={`${repoBaseUrl}/issues/${issue.number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {issue.title}
                        </a>
                      ) : (
                        <span className="truncate">{issue.title}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* PR links */}
              {prs.length > 0 && (
                <div className="space-y-1.5">
                  {prs.map((pr) => (
                    <div key={pr.number} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs shrink-0 text-muted-foreground">PR #{pr.number}</span>
                      {repoBaseUrl ? (
                        <a
                          href={`${repoBaseUrl}/pull/${pr.number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {pr.title}
                        </a>
                      ) : (
                        <span className="truncate">{pr.title}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* ── Project Overview Card ── */}
        <SectionCard
          title="Project Overview"
          sourceLabel={[
            project.llmGeneratedAt ? `LLM enriched ${formatRelativeDate(project.llmGeneratedAt)}` : null,
            project.lastScanned ? `Scanned ${formatRelativeDate(project.lastScanned)}` : null,
          ].filter(Boolean).join(" \u00b7 ") || undefined}
        >
          <div className="space-y-5">
            {/* Summary — LLM one-liner */}
            {project.summary && (
              <p className="text-sm leading-relaxed text-muted-foreground">{project.summary}</p>
            )}

            {/* Status Insight */}
            {project.statusReason && (
              <div>
                <div className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-1.5">Status Insight</div>
                <p className="text-sm leading-relaxed text-foreground/80">{project.statusReason}</p>
              </div>
            )}

            {/* Next Action — de-emphasized */}
            {project.nextAction && (
              <div>
                <div className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-1.5">Next Action</div>
                <p className="text-sm">{project.nextAction}</p>
              </div>
            )}

            {!project.nextAction && !project.summary && (
              <p className="text-sm text-muted-foreground italic">
                Run LLM enrichment to generate insights.
              </p>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-5 gap-4 pt-1">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Framework</div>
                <div className="text-sm">{framework ?? "\u2014"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Languages</div>
                <div className="flex flex-wrap gap-1">
                  {scan?.languages?.detected?.length ? scan.languages.detected.map((lang) => (
                    <span key={lang} className="rounded px-1.5 py-0.5 text-[11px] bg-muted text-muted-foreground">{lang}</span>
                  )) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Services</div>
                <div className="flex flex-wrap gap-1">
                  {services ? services.map((svc) => (
                    <span key={svc} className="rounded px-1.5 py-0.5 text-[11px] bg-muted text-muted-foreground">{svc}</span>
                  )) : <span className="text-sm text-muted-foreground">{"\u2014"}</span>}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">LOC</div>
                <div className="text-sm font-mono">{loc != null ? loc.toLocaleString() : "\u2014"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Commits</div>
                <div className="text-sm font-mono">{scan?.commitCount != null && scan.commitCount > 0 ? scan.commitCount.toLocaleString() : "\u2014"}</div>
              </div>
            </div>

            {/* Insights */}
            {project.insights.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-2">Insights</div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {project.insights.map((insight, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </SectionCard>

        {/* ── Timeline Card ── */}
        <div ref={timelineRef} />
        <SectionCard title="Timeline">
          {timeline.length > 0 ? (() => {
            const ITEMS_PER_PAGE = 10;
            const totalPages = Math.ceil(timeline.length / ITEMS_PER_PAGE);
            const pageItems = timeline.slice(timelinePage * ITEMS_PER_PAGE, (timelinePage + 1) * ITEMS_PER_PAGE);

            return (
              <>
                <div>
                  {pageItems.map((entry) => (
                    <div key={entry.key} className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0">
                      <span
                        className={cn(
                          "text-[10px] font-mono w-8 shrink-0",
                          TIMELINE_TYPE_CLASSES[entry.type] ?? "text-muted-foreground"
                        )}
                      >
                        {entry.type}
                      </span>
                      <span className="text-sm text-muted-foreground truncate">{entry.description}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-auto tabular-nums">
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
                      onClick={() => changeTimelinePage(timelinePage - 1)}
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
                        onClick={() => changeTimelinePage(i)}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="text-xs px-1.5 py-0.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                      disabled={timelinePage === totalPages - 1}
                      onClick={() => changeTimelinePage(timelinePage + 1)}
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
        </SectionCard>

      </div>
    </div>
  );
}
