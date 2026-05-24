"use client";

import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlarmClock, Archive, RotateCcw, X } from "lucide-react";
import React from "react";

interface LifecycleActionsProps {
  project: Project;
  onUpdateOverride: (id: string, fields: Record<string, unknown>) => Promise<unknown>;
  isSnoozed: boolean;
}

export function LifecycleActions({ project, onUpdateOverride, isSnoozed }: LifecycleActionsProps) {
  const [snoozeDays, setSnoozeDays] = React.useState<number | null>(null);

  const isArchived = project.status === "archived";

  async function handleSnooze(days: number) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    until.setHours(0, 0, 0, 0);
    try {
      const result = await onUpdateOverride(project.id, { snoozedUntil: until.toISOString() });
      if ((result as { ok?: boolean })?.ok) {
        toast.success(`Snoozed ${project.name} for ${days} days`);
        setSnoozeDays(null);
      } else {
        toast.error("Failed to snooze project");
      }
    } catch {
      toast.error("Failed to snooze project");
    }
  }

  async function handleUnsnooze() {
    try {
      const result = await onUpdateOverride(project.id, { snoozedUntil: null });
      if ((result as { ok?: boolean })?.ok) {
        toast.success(`Revived ${project.name}`);
      } else {
        toast.error("Failed to revive project");
      }
    } catch {
      toast.error("Failed to revive project");
    }
  }

  async function handleArchive() {
    const note = prompt("What did you learn from this project?");
    if (note === null) return; // cancelled
    try {
      const result = await onUpdateOverride(project.id, {
        statusOverride: "archived",
        archivedNote: note || null,
      });
      if ((result as { ok?: boolean })?.ok) {
        toast.success(`Archived ${project.name}`);
      } else {
        toast.error("Failed to archive project");
      }
    } catch {
      toast.error("Failed to archive project");
    }
  }

  async function handleRevive() {
    try {
      const result = await onUpdateOverride(project.id, {
        statusOverride: null,
        archivedNote: null,
      });
      if ((result as { ok?: boolean })?.ok) {
        toast.success(`Revived ${project.name}`);
      } else {
        toast.error("Failed to revive project");
      }
    } catch {
      toast.error("Failed to revive project");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-card border-b border-border">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Lifecycle
        </h3>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Snoozed indicator */}
        {isSnoozed && project.snoozedUntil && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm">
            <AlarmClock className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-amber-700 dark:text-amber-300">
              Snoozed until {new Date(project.snoozedUntil).toLocaleDateString()}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-xs h-7"
              onClick={handleUnsnooze}
            >
              <RotateCcw className="size-3.5 mr-1" />
              Wake up
            </Button>
          </div>
        )}

        {/* Archived note */}
        {isArchived && project.archivedNote && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
            <Archive className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <span className="text-muted-foreground">Retirement note:</span>{" "}
              <span>{project.archivedNote}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isArchived && !isSnoozed && (
            <>
              {/* Snooze */}
              {snoozeDays === null ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => setSnoozeDays(7)}
                >
                  <AlarmClock className="size-3.5" />
                  Snooze
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  {[7, 14, 30].map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={snoozeDays === d ? "default" : "outline"}
                      className="text-xs h-7"
                      onClick={() => setSnoozeDays(d)}
                    >
                      {d}d
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleSnooze(snoozeDays)}
                    disabled={snoozeDays === null}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => setSnoozeDays(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}

              {/* Archive */}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleArchive}
              >
                <Archive className="size-3.5" />
                Archive
              </Button>
            </>
          )}

          {isArchived && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={handleRevive}
            >
              <RotateCcw className="size-3.5" />
              Revive
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}