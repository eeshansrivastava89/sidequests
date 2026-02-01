"use client";

import type { Project } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

function healthColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusClass = STATUS_COLORS[project.status] ?? STATUS_COLORS.archived;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
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

        {project.scan?.languages?.primary && (
          <p className="text-xs text-muted-foreground">
            {project.scan.languages.primary}
            {project.scan.languages.detected.length > 1 &&
              ` + ${project.scan.languages.detected.length - 1} more`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
