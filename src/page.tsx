import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useConfig } from "@/hooks/use-config";
import { useRefresh } from "@/hooks/use-refresh";
import { useRefreshDeltas } from "@/hooks/use-refresh-deltas";
import { useFocusGoals, useShipped, useVisit, dismissAlert, aggregateActions } from "@/hooks/use-whatnow-data";
import type { Project, WorkflowView, SortKey, PriorityAction } from "@/lib/types";
import {
  SORT_OPTIONS,
  sortProjects,
  filterByView,
  filterBySearch,
  filterBySignal,
  SIGNAL_LABELS,
  loadSortKey,
  saveSortKey,
  getLastRefreshed,
} from "@/lib/dashboard-filters";
import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/status-colors";
import type { StatsBarSignalFilter as SignalFilter } from "@/components/overview-strip";
import { StatsBar } from "@/components/overview-strip";
import { OverviewStrip } from "@/components/overview-strip";
import { ProjectList } from "@/components/project-list";
import { ProjectDetailPane } from "@/components/project-detail-pane";
import { WhatNowTab } from "@/components/whatnow-tab";
import { AnalyticsTab } from "@/components/analytics-tab";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { SettingsModal } from "@/components/settings-modal";
import { ActivityLogPanel } from "@/components/activity-log-panel";
import { DashboardHeader } from "@/components/dashboard-header";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, TriangleAlert, Info, BarChart3, X, Settings } from "lucide-react";
import { toast } from "sonner";

export function DashboardPage() {
  const { projects, loading, error, fetchProjects, updateOverride, togglePin, touchProject } =
    useProjects();
  const { config, configReady, refetch } = useConfig();
  const refreshHook = useRefresh(fetchProjects, {
    onFirstStoreComplete: (count, skipLlm) => {
      if (skipLlm) {
        toast.info(`Scanned ${count} projects.`);
      } else {
        toast.info(`Scanned ${count} projects. Running AI scan...`);
      }
    },
    onScanDone: (summary) => {
      const count = summary.projectCount ?? 0;
      const llmOk = summary.llmSucceeded ?? 0;
      const llmFail = summary.llmFailed ?? 0;
      if (llmFail > 0 && llmOk === 0) {
        toast.error(`Scanned ${count} projects. AI scan failed for ${llmFail}`);
      } else if (llmFail > 0) {
        toast.warning(`Scanned ${count} projects, AI scanned ${llmOk}, ${llmFail} failed`);
      } else if (llmOk > 0) {
        toast.success(`Scanned ${count} projects, AI scanned ${llmOk}`);
      } else {
        toast.success(`Scanned ${count} projects`);
      }
    },
    onError: (message) => {
      toast.error(message);
    },
  });
  const deltaHook = useRefreshDeltas(projects);
  const focusHook = useFocusGoals();
  const shippedHook = useShipped();
  const visitHook = useVisit();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<WorkflowView>("all");
  const [tab, setTab] = useState<"whatnow" | "projects" | "analytics">("whatnow");
  const [sortKey, setSortKey] = useState<SortKey>(() => loadSortKey());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const filteredRef = useRef<Project[]>([]);

  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  const [ghStatus, setGhStatus] = useState<"ok" | "no-auth" | "no-gh" | null>(null);
  const [versionInfo, setVersionInfo] = useState<{ current: string; latest: string | null; updateAvailable: boolean } | null>(null);

  // Check gh auth status on mount
  useEffect(() => {
    fetch("/api/preflight")
      .then((res) => res.json())
      .then((data) => {
        const checks: { name: string; ok: boolean }[] = data.checks ?? [];
        const gh = checks.find((c) => c.name === "gh");
        if (!gh || !gh.ok) { setGhStatus("no-gh"); return; }
        const ghAuth = checks.find((c) => c.name === "gh-auth");
        setGhStatus(ghAuth?.ok ? "ok" : "no-auth");
      })
      .catch(() => {});
  }, []);

  // Check for version updates on mount
  useEffect(() => {
    fetch("/api/version")
      .then((res) => res.json())
      .then((data) => setVersionInfo(data))
      .catch(() => {});
  }, []);

  // Apply theme attribute to <html>
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // Save visit snapshot on page unload using sendBeacon
  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon("/api/visit");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        navigator.sendBeacon("/api/visit");
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const handleFastScan = useCallback(() => {
    deltaHook.snapshot();
    const names = selectedNames.size > 0 ? [...selectedNames] : undefined;
    refreshHook.start({ skipLlm: true, selectedNames: names });
    setSelectedNames(new Set());
    setTab("projects");
  }, [deltaHook, refreshHook, selectedNames]);

  const handleAiScan = useCallback(() => {
    deltaHook.snapshot();
    const names = selectedNames.size > 0 ? [...selectedNames] : undefined;
    refreshHook.start({ selectedNames: names });
    setSelectedNames(new Set());
    setTab("projects");
  }, [deltaHook, refreshHook, selectedNames]);

  const handleToggleSelect = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedNames((prev) => {
      const current = filteredRef.current;
      if (prev.size === current.length) return new Set();
      return new Set(current.map((p) => p.name));
    });
  }, []);

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

  const handleDismissAlert = useCallback(
    (action: PriorityAction) => {
      dismissAlert(action.projectId, action.type, () => {
        fetchProjects();
      });
    },
    [fetchProjects]
  );

  const filtered = useMemo(
    () => sortProjects(filterBySignal(filterBySearch(filterByView(projects, view), search), signalFilter), sortKey),
    [projects, view, search, signalFilter, sortKey]
  );

  // Sync ref for keyboard shortcut closure
  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  // Keyboard shortcuts: j/k navigate projects, Escape closes detail pane
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const ids = filteredRef.current.map((p) => p.id);
        if (ids.length === 0) return;
        const curIdx = selectedId ? ids.indexOf(selectedId) : -1;
        let nextIdx: number;
        if (e.key === "j") {
          nextIdx = curIdx < ids.length - 1 ? curIdx + 1 : curIdx;
        } else {
          nextIdx = curIdx > 0 ? curIdx - 1 : 0;
        }
        setSelectedId(ids[nextIdx]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  const pinnedProjects = useMemo(
    () => filtered.filter((p) => p.pinned),
    [filtered]
  );

  const unpinnedProjects = useMemo(
    () => filtered.filter((p) => !p.pinned),
    [filtered]
  );

  const lastRefreshed = useMemo(() => getLastRefreshed(projects), [projects]);

  // Aggregate actions for What Now tab (excluding snoozed projects)
  const visibleActions = useMemo(
    () => aggregateActions(projects.filter((p) => !p.isSnoozed)),
    [projects]
  );

  // Tab counts for filter labels
  const tabCounts = useMemo(() => ({
    all: projects.length,
    active: filterByView(projects, "active").length,
    completed: filterByView(projects, "completed").length,
    paused: filterByView(projects, "paused").length,
    archived: filterByView(projects, "archived").length,
  }), [projects]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  // Focus goal project options (active projects only)
  const focusProjectOptions = useMemo(
    () => projects
      .filter((p) => p.status !== "archived")
      .map((p) => ({ id: p.id, name: p.name })),
    [projects]
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
        <Button onClick={handleAiScan}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {refreshHook.state.active && <div className="progress-bar" />}
      <DashboardHeader
        lastRefreshed={lastRefreshed}
        versionInfo={versionInfo}
        refreshActive={refreshHook.state.active}
        refreshPhase={refreshHook.state.phase}
        onCancel={refreshHook.cancel}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        onOpenSettings={() => setSettingsOpen(true)}
        onFastScan={handleFastScan}
        onAiScan={handleAiScan}
        selectedNamesCount={selectedNames.size}
      />

      {/* Full-width scrollable content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">

            {ghStatus === "no-auth" && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm text-muted-foreground">
                <Info className="size-4 shrink-0 text-amber-500" />
                <span>
                  GitHub features disabled — <code className="text-xs bg-muted px-1 py-0.5 rounded">gh</code> is not authenticated.
                  Run <code className="text-xs bg-muted px-1 py-0.5 rounded">gh auth login</code> to enable issues, PRs, and CI status.
                </span>
              </div>
            )}
            {ghStatus === "no-gh" && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
                <Info className="size-4 shrink-0" />
                <span>
                  GitHub features unavailable — install <code className="text-xs bg-muted px-1 py-0.5 rounded">gh</code> CLI
                  to see issues, PRs, and CI status.
                </span>
              </div>
            )}

            {/* ── Tab switcher: What Now / Projects ── */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as "whatnow" | "projects")}>
              <TabsList>
                <TabsTrigger value="whatnow" className="gap-1.5">
                  <Target className="size-3.5" />
                  What Now
                  {visibleActions.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center size-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                      {visibleActions.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="projects">
                  Projects ({projects.length})
                </TabsTrigger>
                <TabsTrigger value="analytics">
                  <BarChart3 className="size-3.5" />
                  Analytics
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* ── What Now Tab ── */}
            {tab === "whatnow" && (
              <WhatNowTab
                projects={projects}
                onDismiss={handleDismissAlert}
                onSelectProject={(id) => setSelectedId(id)}
                onSnooze={async (id, days) => {
                  const until = new Date();
                  until.setDate(until.getDate() + days);
                  until.setHours(0, 0, 0, 0);
                  return updateOverride(id, { snoozedUntil: until.toISOString() });
                }}
                onArchive={async (id, note) => updateOverride(id, { statusOverride: "archived", archivedNote: note })}
                onRevive={async (id) => updateOverride(id, { statusOverride: null, archivedNote: null })}
              />
            )}

            {/* ── Analytics Tab ── */}
            {tab === "analytics" && (
              <AnalyticsTab
                projects={projects}
                shipped={shippedHook.shipped}
                shippedLoading={shippedHook.loading}
                visit={visitHook.visit}
                visitLoading={visitHook.loading}
                focusGoals={focusHook.goals}
                focusLoading={focusHook.loading}
                onToggleFocusGoal={(id, completed) => focusHook.updateGoal(id, { completed })}
                onAddFocusGoal={() => setTab("whatnow")}
                onSelectProject={(id) => setSelectedId(id)}
              />
            )}

            {/* ── Projects Tab ── */}
            {tab === "projects" && (
              <div className="space-y-6">
                <StatsBar
                  projects={projects}
                  activeFilter={signalFilter}
                  onFilter={setSignalFilter}
                  onClearAll={() => { setView("all"); setSearch(""); setSignalFilter(null); }}
                />

                {/* Filter tabs + Sort + Search */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Tabs
                      value={view}
                      onValueChange={(v) => setView(v as WorkflowView)}
                    >
                      <TabsList>
                        <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
                        <TabsTrigger value="active">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("size-2 rounded-full", STATUS_COLORS.active)} />
                            Active ({tabCounts.active})
                          </span>
                        </TabsTrigger>
                        <TabsTrigger value="completed">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("size-2 rounded-full", STATUS_COLORS.completed)} />
                            Completed ({tabCounts.completed})
                          </span>
                        </TabsTrigger>
                        {tabCounts.paused > 0 && (
                          <TabsTrigger value="paused">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={cn("size-2 rounded-full", STATUS_COLORS.paused)} />
                              Paused ({tabCounts.paused})
                            </span>
                          </TabsTrigger>
                        )}
                        <TabsTrigger value="archived">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("size-2 rounded-full", STATUS_COLORS.archived)} />
                            Archived ({tabCounts.archived})
                          </span>
                        </TabsTrigger>
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
                {(view !== "all" || search || signalFilter) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {view !== "all" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {view.charAt(0).toUpperCase() + view.slice(1)}
                        <button
                          type="button"
                          className="ml-0.5 rounded-sm hover:bg-amber-200 dark:hover:bg-amber-800/40 p-0.5 transition-colors"
                          onClick={() => setView("all")}
                          aria-label="Clear tab filter"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    )}
                    {signalFilter && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {SIGNAL_LABELS[signalFilter]}
                        <button
                          type="button"
                          className="ml-0.5 rounded-sm hover:bg-amber-200 dark:hover:bg-amber-800/40 p-0.5 transition-colors"
                          onClick={() => setSignalFilter(null)}
                          aria-label="Clear signal filter"
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
                      onClick={() => { setView("all"); setSearch(""); setSignalFilter(null); handleSortChange("lastCommit"); }}
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
                          <Button size="sm" onClick={handleAiScan}>
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
                          refreshProgress={refreshHook.state.active ? refreshHook.state.projects : undefined}
                          selectedNames={selectedNames}
                          onToggleSelect={handleToggleSelect}
                          onSelectAll={handleSelectAll}
                          allSelected={selectedNames.size === filtered.length && filtered.length > 0}
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
                          refreshProgress={refreshHook.state.active ? refreshHook.state.projects : undefined}
                          selectedNames={selectedNames}
                          onToggleSelect={handleToggleSelect}
                          onSelectAll={handleSelectAll}
                          allSelected={selectedNames.size === filtered.length && filtered.length > 0}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
      </main>

      <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-900/50 mt-8">
        <TriangleAlert className="size-3.5 shrink-0" />
        <span>Alpha — AI scans use LLM tokens. Point dev root only at code directories you intend to scan.</span>
      </div>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between text-sm text-muted-foreground">
          <span>&copy; 2026 Eeshan Srivastava</span>
          <span className="italic">Personal project &middot; MIT License</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/eeshansrivastava89/sidequests" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              Source
            </a>
            <a href="https://www.linkedin.com/in/eeshans/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062.06 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/></svg>
              LinkedIn
            </a>
          </div>
        </div>
      </footer>

      {/* Slide-over detail panel */}
      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent>
          <SheetTitle className="sr-only">{selectedProject?.name ?? "Project Details"}</SheetTitle>
          {selectedProject && (
            <>
              <ProjectDetailPane
                key={selectedProject.id}
                project={selectedProject}
                onClose={() => setSelectedId(null)}
                onUpdateOverride={updateOverride}
                onTogglePin={handleTogglePin}
                onTouch={handleTouch}
                delta={selectedId ? deltaHook.deltas?.projects.get(selectedId) ?? null : null}
              />
              <div className="px-6 pb-6">
                <LifecycleActions
                  project={selectedProject}
                  onUpdateOverride={updateOverride}
                  isSnoozed={selectedProject.isSnoozed}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        onSaved={refetch}
      />

      <ActivityLogPanel refreshState={refreshHook.state} projects={projects} config={config} scanProgress={refreshHook.scanProgress} />

    </div>
  );
}