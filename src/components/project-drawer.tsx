"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectDetailPane } from "@/components/project-detail-pane";

/* ── Props ─────────────────────────────────────────────── */

interface ProjectDrawerProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onUpdateOverride: (id: string, fields: Record<string, unknown>) => Promise<unknown>;
  onTogglePin: (id: string) => void;
  onTouch: (id: string, tool: string) => void;
  sanitizePaths?: boolean;
  delta?: { newlyEnriched?: boolean } | null;
}

/* ── Mobile-only Dialog wrapper ────────────────────────── */

export function ProjectDrawer({
  project,
  open,
  onClose,
  onUpdateOverride,
  onTogglePin,
  onTouch,
  sanitizePaths,
  delta,
}: ProjectDrawerProps) {
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsLarge(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // On desktop, the inline pane in page.tsx handles display
  if (isLarge || !project || !open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="inset-0 translate-x-0 translate-y-0 left-0 top-0 w-full max-w-full h-full max-h-full rounded-none">
        <DialogTitle className="sr-only">{project.name}</DialogTitle>
        <ProjectDetailPane
          project={project}
          onClose={onClose}
          onUpdateOverride={onUpdateOverride}
          onTogglePin={onTogglePin}
          onTouch={onTouch}
          sanitizePaths={sanitizePaths}
          delta={delta}
        />
      </DialogContent>
    </Dialog>
  );
}
