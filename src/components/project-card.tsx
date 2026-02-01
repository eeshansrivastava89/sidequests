"use client";

import type { Project } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

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

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  sanitizePaths?: boolean;
}

function healthColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`Copied ${label} command`),
    () => toast.error("Failed to copy")
  );
}

export function ProjectCard({ project, onClick, sanitizePaths = true }: ProjectCardProps) {
  const statusClass = STATUS_COLORS[project.status] ?? STATUS_COLORS.archived;
  const showActions = !sanitizePaths;
  const rawPath = project.pathDisplay;

  return (
    <Card
      className="group cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium leading-tight">
            {project.name}
          </CardTitle>
          <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
            {project.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {project.pathDisplay}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {project.purpose && (
          <p className="text-sm text-muted-foreground line-clamp-2">{project.purpose}</p>
        )}

        <div className="min-h-[3.25rem] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {project.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {project.tags.length > 3 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  +{project.tags.length - 3}
                </Badge>
              )}
            </div>
            <span className={`text-sm font-semibold tabular-nums ${healthColor(project.healthScore)}`}>
              {project.healthScore}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {project.scan?.languages?.primary ? (
              <>
                {project.scan.languages.primary}
                {project.scan.languages.detected.length > 1 &&
                  ` + ${project.scan.languages.detected.length - 1} more`}
              </>
            ) : (
              <span>&nbsp;</span>
            )}
          </p>
        </div>

        {showActions && (
          <div
            className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2 text-[11px] font-medium text-white bg-[#007ACC] border-[#007ACC] hover:bg-[#005F9E] hover:border-[#005F9E] hover:text-white"
              title="Open in VS Code (window behavior depends on your VS Code settings)"
              asChild
            >
              <a href={`vscode://file${encodeURI(rawPath)}`}>
                <VsCodeIcon className="h-3.5 w-3.5" />
                VS Code
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2 text-[11px] font-medium text-white bg-[#D97757] border-[#D97757] hover:bg-[#C4623F] hover:border-[#C4623F] hover:text-white"
              onClick={() => copyToClipboard(`cd "${rawPath}" && claude`, "Claude")}
            >
              <ClipboardCopy className="h-3 w-3" />
              Claude
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2 text-[11px] font-medium text-white bg-[#000000] border-[#000000] hover:bg-[#333333] hover:border-[#333333] hover:text-white"
              onClick={() => copyToClipboard(`cd "${rawPath}" && codex`, "Codex")}
            >
              <ClipboardCopy className="h-3 w-3" />
              Codex
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
