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
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { MethodologyModal } from "@/components/methodology-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, X, Moon, Sun } from "lucide-react";
import { formatRelativeTime } from "@/lib/project-helpers";
import { evaluateAttention } from "@/lib/attention";
import { toast } from "sonner";


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
  const { config, configReady, refetch } = useConfig();
  const refreshHook = useRefresh(fetchProjects);
  const deltaHook = useRefreshDeltas(projects);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<WorkflowView>("all");
  const [sortKey, setSortKey] = useState<SortKey>(() => loadSortKey());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(false);
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

  // Toast on scan/enrich completion or error
  const wasActive = useRef(false);
  useEffect(() => {
    if (refreshHook.state.active) {
      wasActive.current = true;
    } else if (wasActive.current) {
      wasActive.current = false;
      const s = refreshHook.state;
      if (s.error) {
        toast.error(s.error);
      } else if (s.summary) {
        const count = s.summary.projectCount ?? 0;
        if (s.mode === "enrich") {
          toast.success(`Enriched ${s.summary.llmSucceeded ?? 0} of ${count} projects`);
        } else {
          toast.success(`Found ${count} projects`);
        }
      }
    }
  }, [refreshHook.state]);

  // Derive wizard open state — no effects, no render-phase setState
  const wizardOpen = !wizardDismissed && !loading && configReady && !config.hasCompletedOnboarding && projects.length === 0;
  const setWizardOpen = useCallback((open: boolean) => {
    if (!open) setWizardDismissed(true);
  }, []);


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
              <h1 className="text-lg font-semibold tracking-tight">Sidequests</h1>
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
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all active:scale-[0.97] shadow-sm"
                    onClick={() => {
                      if (!config.llmProvider || config.llmProvider === "none") {
                        setSettingsOpen(true);
                      } else {
                        handleRefresh("enrich");
                      }
                    }}
                    title={!config.llmProvider || config.llmProvider === "none" ? "Configure an LLM provider in Settings first" : undefined}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                      <path d="M7 1l1.5 3.5L12 6l-3.5 1.5L7 11 5.5 7.5 2 6l3.5-1.5L7 1z" fill="currentColor" opacity="0.9" />
                      <path d="M11 2l.5 1.2L12.7 3.7l-1.2.5L11 5.4l-.5-1.2-1.2-.5 1.2-.5L11 2z" fill="currentColor" opacity="0.6" />
                    </svg>
                    Enrich with AI
                  </button>
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
            <h2 className="text-lg font-semibold mb-1">Welcome to Sidequests</h2>
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

      <footer className="border-t border-border mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; 2026 Eeshan Srivastava</span>
          <span className="italic">Personal project &middot; MIT License &middot; Non-commercial</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/eeshansrivastava89/sidequests" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              Source
            </a>
            <a href="https://www.linkedin.com/in/eeshans/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.06 2.06 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/></svg>
              LinkedIn
            </a>
          </div>
        </div>
      </footer>

      <ProjectDrawer
        project={selectedProject}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        onUpdateOverride={updateOverride}
        onTogglePin={handleTogglePin}
        onTouch={handleTouch}
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

      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        config={config}
        onSaved={refetch}
        onStartScan={handleRefresh}
        scanState={refreshHook.state}
      />
    </div>
  );
}
