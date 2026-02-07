"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useConfig } from "@/hooks/use-config";
import { useRefresh } from "@/hooks/use-refresh";
import type { Project, WorkflowView, SortKey } from "@/lib/types";
import { StatsBar } from "@/components/stats-bar";
import { ProjectList } from "@/components/project-list";
import { ProjectDrawer } from "@/components/project-drawer";
import { RefreshPanel } from "@/components/refresh-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ── Sort ───────────────────────────────────────────────── */

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "lastCommit", label: "Last Commit" },
  { key: "name", label: "Name" },
  { key: "health", label: "Health" },
  { key: "status", label: "Status" },
  { key: "daysInactive", label: "Days Inactive" },
];

function sortProjects(projects: Project[], sortKey: SortKey): Project[] {
  const sorted = [...projects];
  switch (sortKey) {
    case "lastCommit":
      return sorted.sort((a, b) => {
        const da = a.scan?.lastCommitDate ?? "";
        const db = b.scan?.lastCommitDate ?? "";
        return db.localeCompare(da); // desc
      });
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name)); // asc
    case "health":
      return sorted.sort((a, b) => a.healthScore - b.healthScore); // asc (worst first)
    case "status": {
      const order: Record<string, number> = { active: 0, paused: 1, stale: 2, archived: 3 };
      return sorted.sort(
        (a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99)
      );
    }
    case "daysInactive":
      return sorted.sort((a, b) => {
        const da = a.scan?.daysInactive ?? Infinity;
        const db = b.scan?.daysInactive ?? Infinity;
        return da - db; // asc (least inactive first)
      });
    default:
      return sorted;
  }
}

/* ── Filter ─────────────────────────────────────────────── */

function needsAttention(p: Project): boolean {
  const di = p.scan?.daysInactive ?? 0;
  return (
    p.healthScore < 40 ||
    (di > 30 && !p.nextAction) ||
    (p.isDirty && di > 7)
  );
}

function filterByView(projects: Project[], view: WorkflowView): Project[] {
  switch (view) {
    case "active":
      return projects.filter(
        (p) => p.status === "active" || p.status === "paused"
      );
    case "needs-attention":
      return projects.filter(needsAttention);
    case "stale":
      return projects.filter((p) => p.status === "stale");
    case "archived":
      return projects.filter((p) => p.status === "archived");
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

/* ── LocalStorage helpers ───────────────────────────────── */

function loadSortKey(): SortKey {
  if (typeof window === "undefined") return "lastCommit";
  return (localStorage.getItem("dashboard-sort") as SortKey) ?? "lastCommit";
}

function saveSortKey(key: SortKey) {
  localStorage.setItem("dashboard-sort", key);
}

/* ── Last Refreshed ─────────────────────────────────────── */

function getLastRefreshed(projects: Project[]): string | null {
  let latest: string | null = null;
  for (const p of projects) {
    if (p.lastScanned && (!latest || p.lastScanned > latest)) {
      latest = p.lastScanned;
    }
  }
  return latest;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Page ───────────────────────────────────────────────── */

export default function DashboardPage() {
  const { projects, loading, error, refreshing, fetchProjects, updateOverride, updateMetadata, togglePin, touchProject } =
    useProjects();
  const config = useConfig();
  const refreshHook = useRefresh(fetchProjects);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<WorkflowView>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastCommit");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Hydrate sort key from localStorage after mount
  useEffect(() => {
    setSortKey(loadSortKey());
  }, []);

  const handleSortChange = useCallback((key: SortKey) => {
    setSortKey(key);
    saveSortKey(key);
  }, []);

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

  const handleTogglePin = useCallback(
    (id: string) => {
      togglePin(id);
    },
    [togglePin]
  );

  const handleTouch = useCallback(
    (id: string, tool: string) => {
      touchProject(id, tool);
    },
    [touchProject]
  );

  const filtered = useMemo(
    () => sortProjects(filterBySearch(filterByView(projects, view), search), sortKey),
    [projects, view, search, sortKey]
  );

  const pinnedProjects = useMemo(
    () => filtered.filter((p) => p.pinned),
    [filtered]
  );

  const unpinnedProjects = useMemo(
    () => filtered.filter((p) => !p.pinned),
    [filtered]
  );

  const lastRefreshed = useMemo(() => getLastRefreshed(projects), [projects]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const allVisible = [...pinnedProjects, ...unpinnedProjects];

      switch (e.key) {
        case "Escape":
          if (selectedId) {
            setSelectedId(null);
          }
          break;
        case "Enter": {
          if (!selectedId && allVisible.length > 0) {
            setSelectedId(allVisible[0].id);
          }
          break;
        }
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          if (allVisible.length === 0) break;
          if (!selectedId) {
            setSelectedId(allVisible[0].id);
          } else {
            const idx = allVisible.findIndex((p) => p.id === selectedId);
            if (idx < allVisible.length - 1) {
              setSelectedId(allVisible[idx + 1].id);
            }
          }
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          if (allVisible.length === 0) break;
          if (!selectedId) {
            setSelectedId(allVisible[allVisible.length - 1].id);
          } else {
            const idx = allVisible.findIndex((p) => p.id === selectedId);
            if (idx > 0) {
              setSelectedId(allVisible[idx - 1].id);
            }
          }
          break;
        }
        case "v": {
          if (!config.sanitizePaths && selectedProject?.pathDisplay) {
            window.open(`vscode://file${encodeURI(selectedProject.pathDisplay)}`);
            touchProject(selectedProject.id, "vscode");
          }
          break;
        }
        case "c": {
          if (!config.sanitizePaths && selectedProject?.pathDisplay) {
            navigator.clipboard.writeText(`cd "${selectedProject.pathDisplay}" && claude`);
            touchProject(selectedProject.id, "claude");
          }
          break;
        }
        case "x": {
          if (!config.sanitizePaths && selectedProject?.pathDisplay) {
            navigator.clipboard.writeText(`cd "${selectedProject.pathDisplay}" && codex`);
            touchProject(selectedProject.id, "codex");
          }
          break;
        }
        case "t": {
          if (!config.sanitizePaths && selectedProject?.pathDisplay) {
            navigator.clipboard.writeText(`cd "${selectedProject.pathDisplay}"`);
            touchProject(selectedProject.id, "terminal");
          }
          break;
        }
        case "p": {
          if (selectedProject) {
            handleTogglePin(selectedProject.id);
          }
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, selectedProject, pinnedProjects, unpinnedProjects, handleTogglePin, touchProject, config.sanitizePaths]);

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
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
              {lastRefreshed && (
                <span className="text-xs text-muted-foreground">
                  Last refreshed {formatRelativeTime(lastRefreshed)}
                </span>
              )}
            </div>
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

        {/* Filter tabs + Sort + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as WorkflowView)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="needs-attention">Needs Attention</TabsTrigger>
              <TabsTrigger value="stale">Stale</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => handleSortChange(e.target.value as SortKey)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>

            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full sm:w-64"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-muted-foreground">
              {search ? "No projects match your search." : "No projects in this view."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pinnedProjects.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Pinned
                </h2>
                <ProjectList
                  projects={pinnedProjects}
                  selectedId={selectedId}
                  onSelect={(p) => setSelectedId(p.id)}
                  onTogglePin={handleTogglePin}
                  onTouch={handleTouch}
                  sanitizePaths={config.sanitizePaths}
                />
              </div>
            )}
            {unpinnedProjects.length > 0 && (
              <div>
                {pinnedProjects.length > 0 && (
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Projects
                  </h2>
                )}
                <ProjectList
                  projects={unpinnedProjects}
                  selectedId={selectedId}
                  onSelect={(p) => setSelectedId(p.id)}
                  onTogglePin={handleTogglePin}
                  onTouch={handleTouch}
                  sanitizePaths={config.sanitizePaths}
                />
              </div>
            )}
          </div>
        )}
      </main>

      <ProjectDrawer
        project={selectedProject}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        onUpdateOverride={updateOverride}
        onUpdateMetadata={updateMetadata}
        onTogglePin={handleTogglePin}
        onTouch={handleTouch}
        featureO1={config.featureO1}
        onExport={handleExport}
      />
    </div>
  );
}
