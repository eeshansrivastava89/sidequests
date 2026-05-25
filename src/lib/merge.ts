import { db } from "./db";
import type { Project } from "@/generated/prisma/client";
import type { RawScan } from "./types";

/**
 * Merged project view — the single shape the UI consumes.
 * Fields are resolved by priority (varies by field):
 *   status:     Override > Derived > "archived"
 *   summary:    Override > LLM > Legacy LLM > Scan description
 *   nextAction: Metadata > LLM
 *   tags:       Override > LLM > Derived
 *   General:    Override > Metadata > LLM > Derived > Scan
 */
export interface MergedProject {
  id: string;
  name: string;
  pathHash: string;
  pathDisplay: string;

  // Core fields (derived, overridable)
  status: string;
  healthScore: number;
  hygieneScore: number;
  momentumScore: number;
  scoreBreakdown: Record<string, Record<string, number>>;
  summary: string | null;
  tags: string[];
  insights: Array<{ text: string; severity: "green" | "amber" | "red" }>;
  notes: string | null;

  // Phase 53W: LLM actionable fields
  nextAction: string | null;
  llmStatus: string | null;
  statusReason: string | null;
  // risks removed — use insights

  // Promoted derived columns
  isDirty: boolean;
  dirtyFileCount: number;
  ahead: number;
  behind: number;
  framework: string | null;
  primaryLanguage: string | null;
  branchName: string | null;
  lastCommitDate: string | null;
  locEstimate: number;
  locCode: number;
  locDocs: number;
  locGenerated: number;

  // Raw scan data
  scan: RawScan | null;

  // Scan-derived fields surfaced at top level
  recentCommits: Array<{ hash: string; message: string; date: string }>;
  scripts: string[];
  services: string[];
  packageManager: string | null;
  branchCount: number;
  stashCount: number;
  license: boolean;

  // Commit counts by date range (shipped history)
  weekCommits: number;
  monthCommits: number;
  quarterCommits: number;

  // Project-level fields
  pinned: boolean;
  lastTouchedAt: string | null;
  snoozedUntil: string | null;
  archivedNote: string | null;

  // Metadata (workflow fields)
  goal: string | null;
  audience: string | null;
  successMetrics: string | null;
  publishTarget: string | null;

  // LLM error (null = success or never enriched)
  llmError: string | null;

  // Legacy fields (kept for backward compat)
  liveUrl: string | null;
  llmGeneratedAt: string | null;

  // Phase 52W: GitHub data
  openIssues: number;
  openPrs: number;
  ciStatus: string;
  issuesTopJson: string | null;
  prsTopJson: string | null;
  repoVisibility: string;
  githubFetchedAt: string | null;

  // Extensible key-value data from Scan.metaJson + Llm.extrasJson
  // New scan/LLM fields automatically appear here without schema migration.
  meta: Record<string, unknown>;

  // Timestamps
  createdAt: string;
  lastScanned: string | null;
  updatedAt: string;
}


// ── Portfolio stats ──────────────────────────────────────────────────────

export interface VelocityEntry {
  id: string;
  name: string;
  week: number;
  month: number;
  quarter: number;
  healthScore: number;
  status: string;
}

export interface PortfolioStats {
  statusCounts: Record<string, number>;
  velocity: VelocityEntry[];
  totals: {
    projects: number;
    weekCommits: number;
    monthCommits: number;
    quarterCommits: number;
  };
  momentum: {
    accelerating: number;
    steady: number;
    decelerating: number;
    stalled: number;
  };
  momentumProjects: Record<string, string[]>;
  signals: {
    dirty: number;
    ciFailing: number;
    openIssues: number;
    notOnGitHub: number;
  };
  topActive: VelocityEntry[];
  stalled: VelocityEntry[];
  languages: Array<{ language: string; count: number; weekCommits: number }>;
  frameworks: Array<{ framework: string; count: number; weekCommits: number }>;
  staleProjects: Array<{ id: string; name: string; daysInactive: number; healthScore: number; status: string }>;
  weeklyCommitHistory: Array<{ week: string; totalCommits: number; projects: Record<string, number> }>;
  healthDistribution: Array<{ range: string; count: number }>;
  dailyCommitCounts: Record<string, number>;
}

/**
 * Pure function: compute portfolio statistics from a merged project list.
 * No DB access — call mergeAllProjects() first, then pass the result here.
 */
export function computePortfolioStats(projects: MergedProject[]): PortfolioStats {
  // Status distribution
  const statusCounts: Record<string, number> = {};
  for (const p of projects) {
    const s = p.llmStatus ?? p.status;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  // Commit velocity per project
  const velocity: VelocityEntry[] = projects
    .filter((p) => p.status !== "archived")
    .map((p) => ({
      id: p.id,
      name: p.name,
      week: p.weekCommits,
      month: p.monthCommits,
      quarter: p.quarterCommits,
      healthScore: p.healthScore,
      status: p.llmStatus ?? p.status,
    }))
    .sort((a, b) => b.quarter - a.quarter);

  // Momentum classification
  const momentum = { accelerating: 0, steady: 0, decelerating: 0, stalled: 0 };
  const momentumProjects: Record<string, string[]> = {
    accelerating: [],
    steady: [],
    decelerating: [],
    stalled: [],
  };

  for (const p of velocity) {
    let m: string;
    if (p.quarter === 0) {
      m = "stalled";
    } else if (p.week >= (p.month / 4) * 1.3) {
      m = "accelerating";
    } else if (p.week <= (p.month / 4) * 0.5) {
      m = "decelerating";
    } else {
      m = "steady";
    }
    momentum[m as keyof typeof momentum]++;
    momentumProjects[m as keyof typeof momentumProjects].push(p.name);
  }

  // Totals
  const totals = {
    projects: projects.length,
    weekCommits: velocity.reduce((s, p) => s + p.week, 0),
    monthCommits: velocity.reduce((s, p) => s + p.month, 0),
    quarterCommits: velocity.reduce((s, p) => s + p.quarter, 0),
  };

  // Signals
  const dirty = projects.filter((p) => p.isDirty).length;
  const ciFailing = projects.filter((p) => p.ciStatus === "failure").length;
  const openIssues = projects.reduce((s, p) => s + p.openIssues, 0);
  const notOnGitHub = projects.filter((p) => p.repoVisibility === "not-on-github").length;

  // Top projects by commits
  const topActive = velocity.filter((p) => p.quarter > 0).slice(0, 8);
  const stalled = velocity.filter((p) => p.quarter === 0);

  // Language breakdown
  const langMap: Record<string, { count: number; weekCommits: number }> = {};
  for (const p of projects) {
    if (p.status === "archived") continue;
    const lang = p.primaryLanguage ?? "Unknown";
    if (!langMap[lang]) langMap[lang] = { count: 0, weekCommits: 0 };
    langMap[lang].count++;
    langMap[lang].weekCommits += p.weekCommits;
  }
  const languages = Object.entries(langMap)
    .map(([language, d]) => ({ language, ...d }))
    .sort((a, b) => b.weekCommits - a.weekCommits);

  // Framework breakdown
  const fwMap: Record<string, { count: number; weekCommits: number }> = {};
  for (const p of projects) {
    if (p.status === "archived") continue;
    const fw = p.framework ?? "None detected";
    if (!fwMap[fw]) fwMap[fw] = { count: 0, weekCommits: 0 };
    fwMap[fw].count++;
    fwMap[fw].weekCommits += p.weekCommits;
  }
  const frameworks = Object.entries(fwMap)
    .map(([framework, d]) => ({ framework, ...d }))
    .sort((a, b) => b.weekCommits - a.weekCommits);

  // Stale projects (days inactive)
  const staleProjects = projects
    .filter((p) => p.status !== "archived")
    .map((p) => {
      const daysInactive = p.lastCommitDate
        ? Math.floor((Date.now() - new Date(p.lastCommitDate).getTime()) / 86400000)
        : 999;
      return { id: p.id, name: p.name, daysInactive, healthScore: p.healthScore, status: p.llmStatus ?? p.status };
    })
    .sort((a, b) => b.daysInactive - a.daysInactive);

  // Weekly commit history — aggregate from per-project meta.weeklyCommitHistory
  const weekBuckets: Record<string, Record<string, number>> = {};
  for (const p of projects) {
    if (p.status === "archived") continue;
    const history = Array.isArray((p.meta as Record<string, unknown>)?.weeklyCommitHistory)
      ? (p.meta as Record<string, unknown>).weeklyCommitHistory as Array<{ week: string; count: number }>
      : [];
    for (const entry of history) {
      if (!weekBuckets[entry.week]) weekBuckets[entry.week] = {};
      weekBuckets[entry.week][p.name] = entry.count;
    }
  }
  const weeklyCommitHistory = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, projectsMap]) => ({
      week,
      totalCommits: Object.values(projectsMap).reduce((s, c) => s + c, 0),
      projects: projectsMap,
    }));

  // Health score distribution (10-point buckets)
  const healthBuckets: Record<string, number> = {};
  for (const p of projects) {
    const bucket = `${Math.floor(p.healthScore / 10) * 10}-${Math.floor(p.healthScore / 10) * 10 + 9}`;
    healthBuckets[bucket] = (healthBuckets[bucket] ?? 0) + 1;
  }
  const healthDistribution = ["0-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80-89", "90-99", "100-100"].map((range) => ({
    range,
    count: healthBuckets[range] ?? 0,
  }));

  // Daily commit counts (365d) — aggregate across projects for heatmap
  const dailyAgg: Record<string, number> = {};
  for (const p of projects) {
    if (p.status === "archived") continue;
    const counts = (p.meta as Record<string, unknown>)?.dailyCommitCounts;
    if (counts && typeof counts === "object") {
      for (const [date, cnt] of Object.entries(counts as Record<string, number>)) {
        dailyAgg[date] = (dailyAgg[date] ?? 0) + (typeof cnt === "number" ? cnt : 0);
      }
    }
  }

  return {
    statusCounts,
    velocity,
    totals,
    momentum,
    momentumProjects,
    signals: { dirty, ciFailing, openIssues, notOnGitHub },
    topActive,
    stalled,
    languages,
    frameworks,
    staleProjects,
    weeklyCommitHistory,
    healthDistribution,
    dailyCommitCounts: dailyAgg,
  };
}

// ── Visit delta ────────────────────────────────────────────────────────────

/**
 * Lightweight snapshot shape used for visit-delta comparison.
 * Only the fields that matter for "what changed since last visit".
 */
export interface VisitSnapshot {
  id: string;
  name: string;
  status: string;
  healthScore: number;
  weekCommits: number;
  monthCommits: number;
}

/**
 * Delta between two visit snapshots.
 * - added:   project IDs present in current but not previous
 * - removed: project IDs present in previous but not current
 * - changed: per-field changes for projects present in both
 */
export interface VisitDelta {
  added: string[];
  removed: string[];
  changed: Array<{ id: string; name: string; field: string; from: unknown; to: unknown }>;
}

/**
 * Map a full MergedProject[] down to the lightweight snapshot shape
 * used for visit-delta comparison and persistence.
 */
export function snapshotFromProjects(projects: MergedProject[]): VisitSnapshot[] {
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    healthScore: p.healthScore,
    weekCommits: p.weekCommits,
    monthCommits: p.monthCommits,
  }));
}

/**
 * Pure-function delta computation between a current and previous visit snapshot.
 * Returns added/removed project IDs plus per-field changes for surviving projects.
 */
export function computeVisitDelta(
  current: VisitSnapshot[],
  previous: VisitSnapshot[],
): VisitDelta {
  const previousMap = new Map(previous.map((p) => [p.id, p]));
  const currentIds = new Set(current.map((p) => p.id));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ id: string; name: string; field: string; from: unknown; to: unknown }> = [];

  // New projects
  for (const p of current) {
    if (!previousMap.has(p.id)) added.push(p.id);
  }

  // Removed projects
  for (const p of previous) {
    if (!currentIds.has(p.id)) removed.push(p.id);
  }

  // Changed fields
  for (const p of current) {
    const prev = previousMap.get(p.id);
    if (!prev) continue;

    if (p.status !== prev.status) {
      changed.push({ id: p.id, name: p.name, field: "status", from: prev.status, to: p.status });
    }
    if (p.healthScore !== prev.healthScore) {
      changed.push({ id: p.id, name: p.name, field: "healthScore", from: prev.healthScore, to: p.healthScore });
    }
    if (p.weekCommits !== prev.weekCommits) {
      changed.push({ id: p.id, name: p.name, field: "weekCommits", from: prev.weekCommits, to: p.weekCommits });
    }
    if (p.monthCommits !== prev.monthCommits) {
      changed.push({ id: p.id, name: p.name, field: "monthCommits", from: prev.monthCommits, to: p.monthCommits });
    }
  }

  return { added, removed, changed };
}

export function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function mergeProjectView(projectId: string): Promise<MergedProject | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { scan: true, derived: true, llm: true, override: true, metadata: true, github: true },
  });

  if (!project) return null;
  return buildMergedView(project);
}

export async function mergeAllProjects(): Promise<MergedProject[]> {
  const projects = await db.project.findMany({
    where: { prunedAt: null },
    include: { scan: true, derived: true, llm: true, override: true, metadata: true, github: true },
    orderBy: { name: "asc" },
  });

  return projects.map(buildMergedView);
}

/**
 * Lean variant: skips scan.rawJson and scan.metaJson — use for endpoints
 * that don't need the full raw scan blob (portfolio stats, visit delta).
 */
export async function mergeAllProjectsLean(): Promise<MergedProject[]> {
  const projects = await db.project.findMany({
    where: { prunedAt: null },
    include: {
      scan: { select: { scannedAt: true } },
      derived: true,
      llm: true,
      override: true,
      metadata: true,
      github: true,
    },
    orderBy: { name: "asc" },
  });

  return projects.map(buildMergedView);
}

export type ProjectWithRelations = Project & {
  scan: { rawJson?: string; metaJson?: string | null; scannedAt: Date } | null;
  // Note: project.createdAt is available via the Project base type
  derived: {
    statusAuto: string;
    healthScoreAuto: number;
    hygieneScoreAuto: number;
    momentumScoreAuto: number;
    scoreBreakdownJson: string;
    derivedJson: string;
    isDirty: boolean;
    dirtyFileCount: number;
    ahead: number;
    behind: number;
    framework: string | null;
    branchName: string | null;
    lastCommitDate: Date | null;
    locEstimate: number;
    locCode: number;
    locDocs: number;
    locGenerated: number;
    weekCommits: number;
    monthCommits: number;
    quarterCommits: number;
  } | null;
  llm: {
    summary: string | null;
    nextAction: string | null;
    llmStatus: string | null;
    statusReason: string | null;
    risksJson: string | null;
    tagsJson: string | null;
    recommendationsJson: string | null;
    insightsJson: string | null;
    framework: string | null;
    primaryLanguage: string | null;
    llmError: string | null;
    extrasJson: string | null;
    // Legacy fallback (summary supersedes purpose)
    purpose: string | null;
    generatedAt: Date;
  } | null;
  override: {
    statusOverride: string | null;
    purposeOverride: string | null;
    tagsOverride: string | null;
    notesOverride: string | null;
  } | null;
  metadata: {
    goal: string | null;
    audience: string | null;
    successMetrics: string | null;
    nextAction: string | null;
    publishTarget: string | null;
  } | null;
  github: {
    openIssues: number;
    openPrs: number;
    ciStatus: string;
    issuesJson: string | null;
    prsJson: string | null;
    repoVisibility: string;
    fetchedAt: Date;
  } | null;
};

export function buildMergedView(project: ProjectWithRelations): MergedProject {
  const { scan, derived, llm, override, metadata, github } = project;

  const rawScan = parseJson<RawScan | null>(scan?.rawJson, null);
  const derivedData = parseJson<Record<string, unknown>>(derived?.derivedJson, {});

  // status: Override > Derived > "archived" (see per-field merge-priority table below)
  const status =
    override?.statusOverride ??
    derived?.statusAuto ??
    "archived";

  const healthScore = derived?.healthScoreAuto ?? 0;
  const hygieneScore = derived?.hygieneScoreAuto ?? 0;
  const momentumScore = derived?.momentumScoreAuto ?? 0;
  const scoreBreakdown = parseJson<Record<string, Record<string, number>>>(derived?.scoreBreakdownJson, {});

  // Fallback chain: summary (new) > purpose (legacy) > scan description
  const summary =
    override?.purposeOverride ??
    llm?.summary ??
    llm?.purpose ??
    rawScan?.description ??
    null;

  const tags =
    parseJson<string[]>(override?.tagsOverride, null as unknown as string[]) ??
    parseJson<string[]>(llm?.tagsJson, null as unknown as string[]) ??
    (Array.isArray(derivedData.tags) ? derivedData.tags as string[] : []);

  // Consolidated insights — handle new {text,severity} format, legacy string[], and legacy risks+recs
  type Insight = { text: string; severity: "green" | "amber" | "red" };
  const rawInsights = parseJson<unknown[]>(llm?.insightsJson, null as unknown as unknown[]);
  let insights: Insight[];
  if (rawInsights) {
    insights = rawInsights
      .map((r): Insight | null => {
        if (typeof r === "string") return { text: r, severity: "amber" };
        if (r && typeof r === "object" && "text" in r && typeof (r as Record<string, unknown>).text === "string") {
          const sev = (r as Record<string, unknown>).severity;
          const valid = sev === "green" || sev === "amber" || sev === "red";
          return { text: (r as Record<string, unknown>).text as string, severity: valid ? sev as Insight["severity"] : "amber" };
        }
        return null;
      })
      .filter((r): r is Insight => r !== null);
  } else {
    const legacy = [
      ...parseJson<string[]>(llm?.risksJson, []),
      ...parseJson<string[]>(llm?.recommendationsJson, []),
    ];
    insights = legacy.map((t) => ({ text: t, severity: "amber" as const }));
  }
  const notes = override?.notesOverride ?? null;

  // Phase 53W: actionable fields with metadata override priority
  const nextAction = metadata?.nextAction ?? llm?.nextAction ?? null;
  const llmStatus = llm?.llmStatus ?? null;
  const statusReason = llm?.statusReason ?? null;

  return {
    id: project.id,
    name: project.name,
    pathHash: project.pathHash,
    pathDisplay: project.pathDisplay,

    status,
    healthScore,
    hygieneScore,
    momentumScore,
    scoreBreakdown,
    summary,
    tags,
    insights,
    notes,

    nextAction,
    llmStatus,
    statusReason,

    // Promoted derived columns
    isDirty: derived?.isDirty ?? rawScan?.isDirty ?? false,
    dirtyFileCount: derived?.dirtyFileCount ?? 0,
    ahead: derived?.ahead ?? rawScan?.ahead ?? 0,
    behind: derived?.behind ?? rawScan?.behind ?? 0,
    framework: llm?.framework ?? null,
    primaryLanguage: llm?.primaryLanguage ?? null,
    branchName: derived?.branchName ?? rawScan?.branch ?? null,
    lastCommitDate: derived?.lastCommitDate?.toISOString() ?? rawScan?.lastCommitDate ?? null,
    locEstimate: derived?.locEstimate ?? rawScan?.locEstimate ?? 0,
    locCode: derived?.locCode ?? 0,
    locDocs: derived?.locDocs ?? 0,
    locGenerated: derived?.locGenerated ?? 0,

    weekCommits: derived?.weekCommits ?? 0,
    monthCommits: derived?.monthCommits ?? 0,
    quarterCommits: derived?.quarterCommits ?? 0,

    scan: rawScan,

    // Scan-derived fields surfaced at top level
    recentCommits: rawScan?.recentCommits ?? [],
    scripts: rawScan?.scripts ?? [],
    services: rawScan?.services ?? [],
    packageManager: rawScan?.packageManager ?? null,
    branchCount: rawScan?.branchCount ?? 0,
    stashCount: rawScan?.stashCount ?? 0,
    license: rawScan?.license ?? false,

    // Project-level fields
    pinned: project.pinned,
    lastTouchedAt: project.lastTouchedAt?.toISOString() ?? null,
    snoozedUntil: project.snoozedUntil?.toISOString() ?? null,
    archivedNote: project.archivedNote ?? null,

    goal: metadata?.goal ?? null,
    audience: metadata?.audience ?? null,
    successMetrics: metadata?.successMetrics ?? null,
    publishTarget: metadata?.publishTarget ?? null,

    llmError: llm?.llmError ?? null,
    liveUrl: rawScan?.liveUrl ?? null,
    llmGeneratedAt: llm?.generatedAt?.toISOString() ?? null,

    // GitHub data
    openIssues: github?.openIssues ?? 0,
    openPrs: github?.openPrs ?? 0,
    ciStatus: github?.ciStatus ?? "none",
    issuesTopJson: github?.issuesJson ?? null,
    prsTopJson: github?.prsJson ?? null,
    repoVisibility: github?.repoVisibility ?? "not-on-github",
    githubFetchedAt: github?.fetchedAt?.toISOString() ?? null,

    // Extensible metadata: merge scan meta + LLM extras
    meta: {
      ...parseJson(scan?.metaJson, {} as Record<string, unknown>),
      ...parseJson(llm?.extrasJson, {} as Record<string, unknown>),
    },

    createdAt: project.createdAt.toISOString(),
    lastScanned: scan?.scannedAt?.toISOString() ?? null,
    updatedAt: project.updatedAt.toISOString(),
  };
}
