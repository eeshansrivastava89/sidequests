"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const VALID_STATUSES = ["active", "in-progress", "stale", "archived"] as const;
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectDrawerProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onUpdateOverride: (id: string, fields: Record<string, unknown>) => Promise<unknown>;
  onUpdateMetadata: (id: string, fields: Record<string, unknown>) => Promise<unknown>;
  featureO1?: boolean;
  onExport?: (projectId: string) => void;
}

function StatusSelect({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
      <select
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {VALID_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
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
        <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
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
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-col gap-1.5">
        {multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScanDetails({ project }: { project: Project }) {
  const scan = project.scan;
  if (!scan) return <p className="text-sm text-muted-foreground">No scan data available.</p>;

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <span className="text-muted-foreground">Branch</span>
          <p className="font-mono text-xs">{scan.branch ?? "n/a"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Commits</span>
          <p>{scan.commitCount}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Days Inactive</span>
          <p>{scan.daysInactive ?? "n/a"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">TODOs / FIXMEs</span>
          <p>{scan.todoCount} / {scan.fixmeCount}</p>
        </div>
      </div>

      {scan.lastCommitMessage && (
        <div>
          <span className="text-muted-foreground">Last Commit</span>
          <p className="font-mono text-xs truncate">{scan.lastCommitMessage}</p>
        </div>
      )}

      <div>
        <span className="text-muted-foreground">Languages</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {scan.languages.detected.map((lang) => (
            <Badge key={lang} variant="secondary" className="text-[10px]">
              {lang}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
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
      </div>
    </div>
  );
}

function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="space-y-2">
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

function EvidenceTab({ project, onExport }: { project: Project; onExport?: (id: string) => void }) {
  const hasEvidence = project.evidence && Object.keys(project.evidence).length > 0;
  const hasOutcomes = project.outcomes && Object.keys(project.outcomes).length > 0;

  return (
    <div className="space-y-4">
      {onExport && (
        <Button size="sm" variant="outline" onClick={() => onExport(project.id)}>
          Export Evidence
        </Button>
      )}

      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1">Evidence</h4>
        {hasEvidence ? (
          <div className="rounded-md bg-muted p-3">
            <StructuredData data={project.evidence as Record<string, unknown>} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No evidence data. Use PATCH /api/projects/:id/metadata to add evidenceJson.
          </p>
        )}
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1">Outcomes</h4>
        {hasOutcomes ? (
          <div className="rounded-md bg-muted p-3">
            <StructuredData data={project.outcomes as Record<string, unknown>} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No outcomes data. Use PATCH /api/projects/:id/metadata to add outcomesJson.
          </p>
        )}
      </div>
    </div>
  );
}

export function ProjectDrawer({
  project,
  open,
  onClose,
  onUpdateOverride,
  onUpdateMetadata,
  featureO1,
  onExport,
}: ProjectDrawerProps) {
  if (!project) return null;

  const statusClass = STATUS_COLORS[project.status] ?? STATUS_COLORS.archived;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="text-lg">{project.name}</SheetTitle>
          <p className="text-xs text-muted-foreground font-mono">{project.pathDisplay}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
              {project.status}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {project.healthScore}/100
            </span>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-10rem)]">
          <div className="px-6 pb-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="edit" className="flex-1">Edit</TabsTrigger>
                <TabsTrigger value="scan" className="flex-1">Scan</TabsTrigger>
                {featureO1 && (
                  <TabsTrigger value="evidence" className="flex-1">Evidence</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                {project.purpose && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Purpose</h4>
                    <p className="text-sm">{project.purpose}</p>
                  </div>
                )}

                {project.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {project.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {project.notableFeatures.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">
                      Notable Features
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {project.notableFeatures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {project.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">
                      Recommendations
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-0.5">
                      {project.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {project.notes && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Notes</h4>
                    <p className="text-sm">{project.notes}</p>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {project.goal && (
                    <div>
                      <span className="text-muted-foreground text-xs">Goal</span>
                      <p>{project.goal}</p>
                    </div>
                  )}
                  {project.audience && (
                    <div>
                      <span className="text-muted-foreground text-xs">Audience</span>
                      <p>{project.audience}</p>
                    </div>
                  )}
                  {project.nextAction && (
                    <div>
                      <span className="text-muted-foreground text-xs">Next Action</span>
                      <p>{project.nextAction}</p>
                    </div>
                  )}
                  {project.publishTarget && (
                    <div>
                      <span className="text-muted-foreground text-xs">Publish Target</span>
                      <p>{project.publishTarget}</p>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground pt-2">
                  Last scanned: {project.lastScanned ? new Date(project.lastScanned).toLocaleString() : "never"}
                </div>
              </TabsContent>

              <TabsContent value="edit" className="mt-4 space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Overrides
                </h4>
                <StatusSelect
                  value={project.status}
                  onSave={(v) => onUpdateOverride(project.id, { statusOverride: v })}
                />
                <EditableField
                  label="Purpose"
                  value={project.purpose ?? ""}
                  onSave={(v) => onUpdateOverride(project.id, { purposeOverride: v || null })}
                  multiline
                />
                <EditableField
                  label="Notes"
                  value={project.notes ?? ""}
                  onSave={(v) => onUpdateOverride(project.id, { notesOverride: v || null })}
                  multiline
                />

                <Separator />

                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Metadata
                </h4>
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
                />
                <EditableField
                  label="Next Action"
                  value={project.nextAction ?? ""}
                  onSave={(v) => onUpdateMetadata(project.id, { nextAction: v || null })}
                />
                <EditableField
                  label="Publish Target"
                  value={project.publishTarget ?? ""}
                  onSave={(v) => onUpdateMetadata(project.id, { publishTarget: v || null })}
                />
              </TabsContent>

              <TabsContent value="scan" className="mt-4">
                <ScanDetails project={project} />
              </TabsContent>

              {featureO1 && (
                <TabsContent value="evidence" className="mt-4">
                  <EvidenceTab project={project} onExport={onExport} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
