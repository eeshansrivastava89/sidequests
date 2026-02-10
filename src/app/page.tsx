"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useConfig } from "@/hooks/use-config";
import { useRefresh, type RefreshMode } from "@/hooks/use-refresh";
import { useRefreshDeltas } from "@/hooks/use-refresh-deltas";
import type { Project, WorkflowView, SortKey } from "@/lib/types";
import { StatsBar } from "@/components/stats-bar";
import { ProjectList } from "@/components/project-list";
import { ProjectDrawer } from "@/components/project-drawer";
import { RefreshPanel } from "@/components/refresh-panel";
import { SettingsModal } from "@/components/settings-modal";
import { MethodologyModal } from "@/components/methodology-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, X, Moon, Sun } from "lucide-react";
import { formatRelativeTime } from "@/lib/project-helpers";
import { evaluateAttention } from "@/lib/attention";


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

function filterByView(projects: Project[], view: WorkflowView): Project[] {
  switch (view) {
    case "active":
      return projects.filter((p) => p.status === "active");
    case "paused":
      return projects.filter((p) => p.status === "paused");
    case "needs-attention":
      return projects.filter((p) => evaluateAttention(p).needsAttention);
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

/* ── Page ───────────────────────────────────────────────── */

export default function DashboardPage() {
  const { projects, loading, error, fetchProjects, updateOverride, togglePin, touchProject } =
    useProjects();
  const { config, refetch } = useConfig();
  const refreshHook = useRefresh(fetchProjects);
  const deltaHook = useRefreshDeltas(projects);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<WorkflowView>("all");
  const [sortKey, setSortKey] = useState<SortKey>(() => loadSortKey());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  // Apply dark class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);


  const handleRefresh = useCallback((mode: RefreshMode) => {
    deltaHook.snapshot();
    refreshHook.start(mode);
  }, [deltaHook, refreshHook]);

  const handleSortChange = useCallback((key: SortKey) => {
    setSortKey(key);
    saveSortKey(key);
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

  // Tab counts for filter labels
  const tabCounts = useMemo(() => ({
    all: projects.length,
    active: filterByView(projects, "active").length,
    paused: filterByView(projects, "paused").length,
    "needs-attention": filterByView(projects, "needs-attention").length,
    stale: filterByView(projects, "stale").length,
    archived: filterByView(projects, "archived").length,
  }), [projects]);

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
        <Button onClick={() => handleRefresh("scan")}>Retry</Button>
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
              {refreshHook.state.active ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={refreshHook.cancel}
                >
                  Cancel
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRefresh("scan")}
                  >
                    Scan
                  </Button>
                  {config.featureLlm && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.97] shadow-sm"
                      onClick={() => handleRefresh("enrich")}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                        <path d="M7 1l1.5 3.5L12 6l-3.5 1.5L7 11 5.5 7.5 2 6l3.5-1.5L7 1z" fill="currentColor" opacity="0.9" />
                        <path d="M11 2l.5 1.2L12.7 3.7l-1.2.5L11 5.4l-.5-1.2-1.2-.5 1.2-.5L11 2z" fill="currentColor" opacity="0.6" />
                      </svg>
                      Enrich with AI
                    </button>
                  )}
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setMethodologyOpen(true)}
              >
                Scoring Methodology
              </Button>
              <button
                type="button"
                className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onClick={() => setDark((d) => !d)}
                aria-label="Toggle dark mode"
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
              >
                <Settings className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <RefreshPanel
          state={refreshHook.state}
          onDismiss={refreshHook.dismiss}
          deltaSummary={deltaHook.deltas?.causeSummary}
          projectDeltas={deltaHook.deltas?.projects}
        />

        <StatsBar projects={projects} deltas={deltaHook.deltas} />

        {/* Filter tabs + Sort + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as WorkflowView)}
          >
            <TabsList>
              <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
              <TabsTrigger value="active">Active ({tabCounts.active})</TabsTrigger>
              {tabCounts.paused > 0 && (
                <TabsTrigger value="paused">Paused ({tabCounts.paused})</TabsTrigger>
              )}
              <TabsTrigger value="needs-attention">Needs Attention ({tabCounts["needs-attention"]})</TabsTrigger>
              <TabsTrigger value="stale">Stale ({tabCounts.stale})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({tabCounts.archived})</TabsTrigger>
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

        {/* Active filter chips */}
        {(view !== "all" || search) && (
          <div className="flex items-center gap-2 flex-wrap">
            {view !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                {view === "needs-attention" ? "Needs Attention" : view.charAt(0).toUpperCase() + view.slice(1)}
                <button
                  type="button"
                  className="ml-0.5 rounded-sm hover:bg-accent p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setView("all")}
                  aria-label="Clear tab filter"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                &ldquo;{search}&rdquo;
                <button
                  type="button"
                  className="ml-0.5 rounded-sm hover:bg-accent p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              onClick={() => { setView("all"); setSearch(""); handleSortChange("lastCommit"); }}
            >
              Clear all
            </button>
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length} of {projects.length}
            </span>
          </div>
        )}

        {filtered.length === 0 && projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 px-6">
            <h2 className="text-lg font-semibold mb-1">Welcome to Projects Dashboard</h2>
            <p className="text-sm text-muted-foreground mb-6">Get started in 3 steps:</p>
            <ol className="space-y-4 w-full max-w-sm">
              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center size-6 rounded-full bg-foreground text-background text-xs font-bold shrink-0">1</span>
                <div>
                  <p className="text-sm font-medium">Open Settings</p>
                  <p className="text-xs text-muted-foreground mb-1.5">Configure your dev root directory</p>
                  <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                    <Settings className="size-3.5 mr-1.5" /> Settings
                  </Button>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center size-6 rounded-full bg-foreground text-background text-xs font-bold shrink-0">2</span>
                <div>
                  <p className="text-sm font-medium">Set your Dev Root</p>
                  <p className="text-xs text-muted-foreground">The directory containing your projects (e.g. <code className="bg-muted px-1 rounded">~/dev</code>)</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center size-6 rounded-full bg-foreground text-background text-xs font-bold shrink-0">3</span>
                <div>
                  <p className="text-sm font-medium">Run a Scan</p>
                  <p className="text-xs text-muted-foreground mb-1.5">Discover all git projects in your dev root</p>
                  <Button size="sm" onClick={() => handleRefresh("scan")}>
                    Scan Now
                  </Button>
                </div>
              </li>
            </ol>
          </div>
        ) : filtered.length === 0 ? (
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
                  deltas={deltaHook.deltas}
                  view={view}
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
                  deltas={deltaHook.deltas}
                  view={view}
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
        onTogglePin={handleTogglePin}
        onTouch={handleTouch}
        featureO1={config.featureO1}
        sanitizePaths={config.sanitizePaths}
        delta={selectedId ? deltaHook.deltas?.projects.get(selectedId) ?? null : null}
      />

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        onSaved={refetch}
      />

      <MethodologyModal
        open={methodologyOpen}
        onOpenChange={setMethodologyOpen}
      />
    </div>
  );
}
