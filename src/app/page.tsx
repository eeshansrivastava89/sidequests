"use client";

import { useCallback, useMemo, useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useConfig } from "@/hooks/use-config";
import { useRefresh } from "@/hooks/use-refresh";
import type { Project, WorkflowView } from "@/lib/types";
import { StatsBar } from "@/components/stats-bar";
import { ProjectCard } from "@/components/project-card";
import { ProjectDrawer } from "@/components/project-drawer";
import { RefreshPanel } from "@/components/refresh-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function filterByView(projects: Project[], view: WorkflowView): Project[] {
  switch (view) {
    case "next-actions":
      return projects.filter((p) => p.nextAction);
    case "publish-queue":
      return projects.filter((p) => p.publishTarget);
    case "stalled":
      return projects.filter((p) => p.status === "stale" || p.status === "archived");
    default:
      return projects;
  }
}

function filterBySearch(projects: Project[], query: string): Project[] {
  if (!query) return projects;
  const q = query.toLowerCase();
  return projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.status.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.purpose?.toLowerCase().includes(q) ||
      p.scan?.languages?.primary?.toLowerCase().includes(q)
  );
}

export default function DashboardPage() {
  const { projects, loading, error, refreshing, fetchProjects, updateOverride, updateMetadata } =
    useProjects();
  const config = useConfig();
  const refreshHook = useRefresh(fetchProjects);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<WorkflowView>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async (projectId?: string) => {
    setExporting(true);
    try {
      const res = await fetch("/api/o1/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      const data = await res.json();
      if (!data.ok) return;

      const blob = new Blob([data.export.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = projectId ? `${projectId}-evidence.md` : "portfolio-evidence.md";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, []);

  const filtered = useMemo(
    () => filterBySearch(filterByView(projects, view), search),
    [projects, view, search]
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={refreshHook.start}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
            <div className="flex items-center gap-2">
              {config.featureO1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport()}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : "Export All"}
                </Button>
              )}
              {refreshHook.state.active ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={refreshHook.cancel}
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refreshHook.start}
                >
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <RefreshPanel state={refreshHook.state} />

        <StatsBar projects={projects} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as WorkflowView)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="next-actions">Next Actions</TabsTrigger>
              <TabsTrigger value="publish-queue">Publish Queue</TabsTrigger>
              <TabsTrigger value="stalled">Stalled</TabsTrigger>
            </TabsList>
          </Tabs>

          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full sm:w-64"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-muted-foreground">
              {search ? "No projects match your search." : "No projects in this view."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => setSelectedId(project.id)}
                sanitizePaths={config.sanitizePaths}
              />
            ))}
          </div>
        )}
      </main>

      <ProjectDrawer
        project={selectedProject}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        onUpdateOverride={updateOverride}
        onUpdateMetadata={updateMetadata}
        featureO1={config.featureO1}
        onExport={handleExport}
      />
    </div>
  );
}
