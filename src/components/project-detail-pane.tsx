"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VsCodeIcon, ClaudeIcon, CodexIcon, TerminalIcon, PinIcon } from "@/components/project-icons";
import { copyToClipboard, formatRelativeDate } from "@/lib/project-helpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

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
  source?: { type: "scan" | "llm" | "github"; timestamp: string | null };
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border border-border rounded-lg p-3", highlight && "border-l-2 border-l-amber-400")}>
      <div className="flex items-center justify-between mb-2">
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

function parseGitHubOwnerRepo(remoteUrl: string | null | undefined): { owner: string; repo: string } | null {
  if (!remoteUrl) return null;
  const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  const httpsMatch = remoteUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  return null;
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

  // Reset state + fetch activity when project changes
  useEffect(() => {
    setActivities([]);
    setTimelinePage(0);
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
  const framework = project.framework ?? scan?.languages?.primary ?? null;
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
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold leading-tight truncate">{project.name}</h2>
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
            className="ml-auto flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            onClick={onClose}
            aria-label="Close detail pane"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{rawPath}</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

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

        {/* Last commit message */}
        {scan?.lastCommitMessage && (
          <div className="font-mono text-sm bg-muted/50 rounded px-2.5 py-1.5 text-foreground/80">
            {scan.lastCommitMessage}
          </div>
        )}

        {/* ── Section 1: GitHub ── */}
        {hasGitHub && (
          <SectionBox
            title="GitHub"
            source={{ type: "github", timestamp: project.githubFetchedAt }}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                {issuesUrl ? (
                  <a href={issuesUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {project.openIssues} {project.openIssues === 1 ? "issue" : "issues"}
                  </a>
                ) : (
                  <span>{project.openIssues} {project.openIssues === 1 ? "issue" : "issues"}</span>
                )}
                {prsUrl ? (
                  <a href={prsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {project.openPrs} {project.openPrs === 1 ? "PR" : "PRs"}
                  </a>
                ) : (
                  <span>{project.openPrs} {project.openPrs === 1 ? "PR" : "PRs"}</span>
                )}
                {actionsUrl ? (
                  <a href={actionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                    CI: <CiStatusLabel status={project.ciStatus} />
                  </a>
                ) : (
                  <span className="flex items-center gap-1">CI: <CiStatusLabel status={project.ciStatus} /></span>
                )}
                {project.repoVisibility !== "unknown" && (
                  <Badge variant="outline" className="text-[10px]">{project.repoVisibility}</Badge>
                )}
              </div>

              {issues.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Top Issues</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {issues.map((issue) => (
                      <li key={issue.number} className="text-sm flex items-center gap-1.5">
                        <span className="text-muted-foreground font-mono text-xs">#{issue.number}</span>
                        {repoBaseUrl ? (
                          <a
                            href={`${repoBaseUrl}/issues/${issue.number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate hover:underline"
                          >
                            {issue.title}
                          </a>
                        ) : (
                          <span className="truncate">{issue.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {prs.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Open PRs</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {prs.map((pr) => (
                      <li key={pr.number} className="text-sm flex items-center gap-1.5">
                        <span className="text-muted-foreground font-mono text-xs">#{pr.number}</span>
                        {repoBaseUrl ? (
                          <a
                            href={`${repoBaseUrl}/pull/${pr.number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate hover:underline"
                          >
                            {pr.title}
                          </a>
                        ) : (
                          <span className="truncate">{pr.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SectionBox>
        )}

        {/* ── Section 2: Next Action & Risks ── */}
        <SectionBox
          title="Next Action & Risks"
          source={{ type: "llm", timestamp: project.llmGeneratedAt }}
          highlight={delta?.newlyEnriched}
        >
          {project.nextAction || project.risks.length > 0 || project.recommendations.length > 0 ? (
            <div className="space-y-3">
              {project.nextAction && (
                <div className="rounded-md bg-muted p-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Next Action</span>
                  <p className="text-sm font-medium mt-0.5">{project.nextAction}</p>
                </div>
              )}
              {project.risks.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Risks</span>
                  <ul className="list-disc list-inside text-sm space-y-0.5 mt-0.5">
                    {project.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {project.recommendations.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Recommendations</span>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-0.5">
                    {project.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Run LLM enrichment to generate insights.
            </p>
          )}
        </SectionBox>

        {/* ── Section 3: Summary ── */}
        <SectionBox
          title="Summary"
          source={{ type: "llm", timestamp: project.llmGeneratedAt }}
          highlight={delta?.newlyEnriched}
        >
          {project.summary ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">{project.summary}</p>
              {project.llmStatus && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{project.llmStatus}</Badge>
                  {project.statusReason && (
                    <span className="text-xs text-muted-foreground">{project.statusReason}</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Run LLM enrichment to generate summary.
            </p>
          )}
        </SectionBox>

        {/* ── Section 4: Details ── */}
        <SectionBox
          title="Details"
          source={{ type: "scan", timestamp: project.lastScanned }}
        >
          <div className="space-y-3">
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

            {scan?.commitCount != null && scan.commitCount > 0 && (
              <div className="text-[10px] text-muted-foreground pt-1">
                {scan.commitCount} commits
              </div>
            )}
          </div>
        </SectionBox>

        {/* ── Section 5: Timeline ── */}
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

      </div>
    </div>
  );
}
