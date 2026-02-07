"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ── Constants ─────────────────────────────────────────── */

const VALID_STATUSES = ["active", "paused", "stale", "archived"] as const;

/* ── Icons ─────────────────────────────────────────────── */

function VsCodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.583 2.213l-4.52 4.275L7.95 2.213 2.4 4.831v14.338l5.55 2.618 5.113-4.275 4.52 4.275L23.6 19.17V4.831l-6.017-2.618zM7.95 15.6l-3.15-2.1V10.5l3.15 2.1v3zm5.113-3.6L7.95 8.4V5.4l5.113 3.6v3zm4.52 3.6l-3.15-2.1v-3l3.15 2.1v3z" />
    </svg>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-3.5 5h7a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5zm1 3.5h5a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5z" />
    </svg>
  );
}

function CodexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h6v2H8v-2z" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function PinIcon({ filled, className }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2L14.5 3.5L18.5 7.5L20 6L16 2ZM12.5 5.5L8 10L9 14L2 21H3L10 14L14 15L18.5 10.5L12.5 5.5Z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76z" />
    </svg>
  );
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={cn("size-4 transition-transform", open && "rotate-90", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/* ── Helpers ────────────────────────────────────────────── */

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`Copied ${label} command`),
    () => toast.error("Failed to copy")
  );
}

function healthColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Editable Components ───────────────────────────────── */

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

function EditableField({
  label,
  value,
  onSave,
  multiline = false,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div className="group">
        <div className="text-xs font-medium text-muted-foreground mb-0.5">{label}</div>
        <div
          className="text-sm cursor-pointer rounded px-2 py-1 -mx-2 hover:bg-muted transition-colors whitespace-pre-wrap"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
        >
          {value || <span className="text-muted-foreground italic">Click to edit</span>}
        </div>
      </div>
    );
  }

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-0.5">{label}</div>
      <div className="flex flex-col gap-1">
        {multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[3rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        )}
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" onClick={save}>
            Save
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Collapsible Section ───────────────────────────────── */

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronIcon open={open} />
        {title}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

/* ── Structured Data (for evidence/outcomes) ───────────── */

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

/* ── Drawer Props ──────────────────────────────────────── */

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

function activityIcon(entry: ActivityEntry): string {
  if (entry.type === "opened") {
    const tool = entry.payload?.tool as string | undefined;
    if (tool === "vscode") return "\u25B6";
    if (tool === "claude") return "\u2728";
    if (tool === "codex") return "\u2318";
    if (tool === "terminal") return ">";
  }
  if (entry.type === "scan") return "\u21BB";
  if (entry.type === "llm") return "\u2606";
  if (entry.type === "pin") return "\u2302";
  if (entry.type === "override") return "\u270E";
  if (entry.type === "metadata") return "\u2630";
  return "\u2022";
}

interface ProjectDrawerProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onUpdateOverride: (id: string, fields: Record<string, unknown>) => Promise<unknown>;
  onUpdateMetadata: (id: string, fields: Record<string, unknown>) => Promise<unknown>;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  featureO1?: boolean;
  onExport?: (projectId: string) => void;
}

/* ── Main Drawer ───────────────────────────────────────── */

export function ProjectDrawer({
  project,
  open,
  onClose,
  onUpdateOverride,
  onUpdateMetadata,
  onTogglePin,
  onTouch,
  featureO1,
  onExport,
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
  const statusClass = STATUS_COLORS[project.status] ?? STATUS_COLORS.archived;
  const rawPath = project.pathDisplay;

  const recentCommits = project.recentCommits.length > 0 ? project.recentCommits : null;
  const scripts = Object.keys(project.scripts).length > 0 ? project.scripts : null;
  const services = project.services.length > 0 ? project.services : null;
  const framework = project.framework ?? scan?.languages?.primary ?? null;
  const branchName = project.branchName ?? scan?.branch ?? null;
  const isDirty = project.isDirty;
  const ahead = project.ahead;
  const behind = project.behind;
  const loc = project.locEstimate || null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
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
          <p className="text-xs text-muted-foreground font-mono truncate">{rawPath}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

            {/* ── Left Column: At a Glance ── */}
            <div className="space-y-3">

              {/* Status + Health + Branch row */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusSelect
                  value={project.status}
                  onSave={(v) => onUpdateOverride(project.id, { statusOverride: v })}
                />
                <span className={cn("text-xl font-bold tabular-nums", healthColor(project.healthScore))}>
                  {project.healthScore}
                </span>
                <span className="text-xs text-muted-foreground">/100</span>
                {branchName && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {branchName}
                  </Badge>
                )}
                {isDirty && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    dirty
                  </Badge>
                )}
                {ahead != null && ahead > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    ↑{ahead}
                  </Badge>
                )}
                {behind != null && behind > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    ↓{behind}
                  </Badge>
                )}
              </div>

              {/* Temporal row */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {scan?.daysInactive != null && (
                  <span>{scan.daysInactive}d inactive</span>
                )}
                <span>Last commit {formatDate(scan?.lastCommitDate)}</span>
                <span className={statusClass + " rounded-full px-2 py-0.5 text-[10px] font-medium"}>
                  {project.status}
                </span>
              </div>

              {/* Last commit message */}
              {scan?.lastCommitMessage && (
                <div className="font-mono text-xs bg-muted/50 rounded px-2.5 py-1.5 text-foreground/80">
                  {scan.lastCommitMessage}
                </div>
              )}

              {/* Next Action (inline editable, highlighted) */}
              <div className={cn(
                "rounded-md px-3 py-2",
                project.nextAction
                  ? "border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40"
                  : "border border-dashed border-muted-foreground/30"
              )}>
                <EditableField
                  label="Next Action"
                  value={project.nextAction ?? ""}
                  onSave={(v) => onUpdateMetadata(project.id, { nextAction: v || null })}
                />
              </div>

              {/* Notes (inline editable) */}
              <EditableField
                label="Notes"
                value={project.notes ?? ""}
                onSave={(v) => onUpdateOverride(project.id, { notesOverride: v || null })}
                multiline
              />

              {/* Quick Actions */}
              <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
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
                  size="xs"
                  variant="ghost"
                  className="ml-1 text-muted-foreground"
                  title="Copy path"
                  onClick={() => copyToClipboard(rawPath, "path")}
                >
                  Copy path
                </Button>
              </div>
            </div>

            {/* ── Right Column: Activity + Details + Workflow ── */}
            <div className="space-y-1">

              {/* ── Recent Activity ── */}
              <Section title="Recent Activity" defaultOpen>
                <div className="space-y-1">
                  {recentCommits && recentCommits.length > 0 ? (
                    recentCommits.slice(0, 10).map((commit, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                        <span className="text-muted-foreground shrink-0 tabular-nums w-16">
                          {formatDate(commit.date)}
                        </span>
                        <span className="font-mono text-foreground/80 truncate">
                          {commit.message}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground py-1">
                      {scan?.lastCommitMessage ? (
                        <div className="space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-muted-foreground shrink-0 tabular-nums w-16">
                              {formatDate(scan.lastCommitDate)}
                            </span>
                            <span className="font-mono truncate">{scan.lastCommitMessage}</span>
                          </div>
                          <p className="italic text-muted-foreground/60">
                            Full commit history available after next scan update.
                          </p>
                        </div>
                      ) : (
                        "No commit history available."
                      )}
                    </div>
                  )}

                  {/* Activity Timeline */}
                  {activities.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Activity Log
                      </div>
                      {activities.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 text-xs py-0.5">
                          <span className="w-4 text-center text-muted-foreground shrink-0">
                            {activityIcon(entry)}
                          </span>
                          <span className="text-foreground/80 truncate">
                            {activityLabel(entry)}
                          </span>
                          <span className="text-muted-foreground shrink-0 ml-auto tabular-nums">
                            {formatDate(entry.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              <Separator />

              {/* ── Details ── */}
              <Section title="Details">
                <div className="space-y-3">
                  <EditableField
                    label="Purpose"
                    value={project.purpose ?? ""}
                    onSave={(v) => onUpdateOverride(project.id, { purposeOverride: v || null })}
                    multiline
                  />

                  <EditableField
                    label="Tags"
                    value={project.tags.join(", ")}
                    onSave={(v) =>
                      onUpdateOverride(project.id, {
                        tagsOverride: v
                          ? JSON.stringify(v.split(",").map((t) => t.trim()).filter(Boolean))
                          : null,
                      })
                    }
                  />

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {framework && (
                      <div>
                        <span className="text-xs text-muted-foreground">Framework</span>
                        <p className="font-mono text-xs">{framework}</p>
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
                  </div>

                  {scripts && Object.keys(scripts).length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Scripts</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.keys(scripts).map((name) => (
                          <Badge key={name} variant="outline" className="text-[10px] font-mono">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {services && services.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Services</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {services.map((svc) => (
                          <Badge key={svc} variant="secondary" className="text-[10px]">
                            {svc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {scan?.files && (
                      <div>
                        <span className="text-muted-foreground text-xs">Files</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(scan.files)
                            .filter(([, v]) => v)
                            .map(([k]) => (
                              <Badge key={k} variant="outline" className="text-[10px]">
                                {k}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}
                    {scan?.cicd && (
                      <div>
                        <span className="text-muted-foreground text-xs">CI/CD</span>
                        <div className="flex flex-wrap gap-1 mt-1">
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
                    {scan?.deployment && (
                      <div>
                        <span className="text-muted-foreground text-xs">Deploy</span>
                        <div className="flex flex-wrap gap-1 mt-1">
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
                  </div>

                  {loc != null && (
                    <div>
                      <span className="text-xs text-muted-foreground">Lines of Code</span>
                      <p className="text-sm font-mono tabular-nums">{loc.toLocaleString()}</p>
                    </div>
                  )}

                  {scan && (scan.todoCount > 0 || scan.fixmeCount > 0) && (
                    <div>
                      <span className="text-xs text-muted-foreground">Code markers</span>
                      <p className="text-sm">
                        {scan.todoCount} TODOs / {scan.fixmeCount} FIXMEs
                      </p>
                    </div>
                  )}

                  {project.notableFeatures.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Notable Features</span>
                      <ul className="list-disc list-inside text-sm space-y-0.5 mt-0.5">
                        {project.notableFeatures.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {project.recommendations.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Recommendations</span>
                      <ul className="list-disc list-inside text-sm space-y-0.5 mt-0.5">
                        {project.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground pt-1">
                    Scanned {formatDate(project.lastScanned)}
                    {scan?.commitCount != null && ` · ${scan.commitCount} commits`}
                  </div>
                </div>
              </Section>

              <Separator />

              {/* ── Workflow ── */}
              <Section title="Workflow">
                <div className="space-y-3">
                  <EditableField
                    label="Goal"
                    value={project.goal ?? ""}
                    onSave={(v) => onUpdateMetadata(project.id, { goal: v || null })}
                  />
                  <EditableField
                    label="Audience"
                    value={project.audience ?? ""}
                    onSave={(v) => onUpdateMetadata(project.id, { audience: v || null })}
                  />
                  <EditableField
                    label="Success Metrics"
                    value={project.successMetrics ?? ""}
                    onSave={(v) => onUpdateMetadata(project.id, { successMetrics: v || null })}
                    multiline
                  />
                  <EditableField
                    label="Publish Target"
                    value={project.publishTarget ?? ""}
                    onSave={(v) => onUpdateMetadata(project.id, { publishTarget: v || null })}
                  />

                  {featureO1 && (
                    <>
                      <Separator />

                      {onExport && (
                        <Button size="sm" variant="outline" onClick={() => onExport(project.id)}>
                          Export Evidence
                        </Button>
                      )}

                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Evidence</span>
                        {project.evidence && Object.keys(project.evidence).length > 0 ? (
                          <div className="rounded-md bg-muted p-2.5 mt-1">
                            <StructuredData data={project.evidence} />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic mt-0.5">
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
                          <p className="text-xs text-muted-foreground italic mt-0.5">
                            No outcomes data.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Section>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
