import { db } from "./db";
import { config } from "./config";
import type { Project } from "@/generated/prisma/client";
import type { AiInsight } from "./llm/provider";
import type { RawScan } from "./types";

/**
 * Merged project view — the single shape the UI consumes.
 * Fields are resolved by priority: Override > Metadata > Derived > LLM > Scan
 */
export interface MergedProject {
  id: string;
  name: string;
  pathDisplay: string;

  // Core fields (derived, overridable)
  status: string;
  healthScore: number;
  hygieneScore: number;
  momentumScore: number;
  scoreBreakdown: Record<string, Record<string, number>>;
  purpose: string | null;
  tags: string[];
  notableFeatures: string[];
  recommendations: string[];
  notes: string | null;

  // Promoted derived columns
  isDirty: boolean;
  ahead: number;
  behind: number;
  framework: string | null;
  branchName: string | null;
  lastCommitDate: string | null;
  locEstimate: number;

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

  // Project-level fields
  pinned: boolean;
  lastTouchedAt: string | null;

  // Metadata (workflow fields)
  goal: string | null;
  audience: string | null;
  successMetrics: string | null;
  nextAction: string | null;
  publishTarget: string | null;

  // AI structured insight
  aiInsight: AiInsight | null;

  // New Phase 29 fields
  pitch: string | null;
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

  // Timestamps
  lastScanned: string | null;
  updatedAt: string;
}


export function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

export function parseAiInsightJson(json: string | null | undefined): AiInsight | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.score !== "number" || !VALID_CONFIDENCE.has(obj.confidence)) return null;
    if (!Array.isArray(obj.reasons) || typeof obj.nextBestAction !== "string") return null;
    return obj as AiInsight;
  } catch {
    return null;
  }
}

export function sanitizePath(pathDisplay: string): string {
  if (!config.sanitizePaths) return pathDisplay;
  // Replace home directory with ~
  const parts = pathDisplay.split("/");
  // Show only last 2 segments: ~/parent/project
  if (parts.length > 2) {
    return "~/" + parts.slice(-2).join("/");
  }
  return pathDisplay;
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

export type ProjectWithRelations = Project & {
  scan: { rawJson: string; scannedAt: Date } | null;
  derived: {
    statusAuto: string;
    healthScoreAuto: number;
    hygieneScoreAuto: number;
    momentumScoreAuto: number;
    scoreBreakdownJson: string;
    derivedJson: string;
    isDirty: boolean;
    ahead: number;
    behind: number;
    framework: string | null;
    branchName: string | null;
    lastCommitDate: Date | null;
    locEstimate: number;
  } | null;
  llm: {
    purpose: string | null;
    tagsJson: string | null;
    notableFeaturesJson: string | null;
    recommendationsJson: string | null;
    pitch: string | null;
    aiInsightJson: string | null;
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

  // Priority: Override > Metadata > Derived > LLM > Scan
  const status =
    override?.statusOverride ??
    derived?.statusAuto ??
    "archived";

  const healthScore = derived?.healthScoreAuto ?? 0;
  const hygieneScore = derived?.hygieneScoreAuto ?? 0;
  const momentumScore = derived?.momentumScoreAuto ?? 0;
  const scoreBreakdown = parseJson<Record<string, Record<string, number>>>(derived?.scoreBreakdownJson, {});

  const purpose =
    override?.purposeOverride ??
    llm?.purpose ??
    rawScan?.description ??
    null;

  const tags =
    parseJson<string[]>(override?.tagsOverride, null as unknown as string[]) ??
    parseJson<string[]>(llm?.tagsJson, null as unknown as string[]) ??
    (Array.isArray(derivedData.tags) ? derivedData.tags as string[] : []);

  const notableFeatures = parseJson<string[]>(llm?.notableFeaturesJson, []);
  const recommendations = parseJson<string[]>(llm?.recommendationsJson, []);
  const notes = override?.notesOverride ?? null;

  return {
    id: project.id,
    name: project.name,
    pathDisplay: sanitizePath(project.pathDisplay),

    status,
    healthScore,
    hygieneScore,
    momentumScore,
    scoreBreakdown,
    purpose,
    tags,
    notableFeatures,
    recommendations,
    notes,

    // Promoted derived columns
    isDirty: derived?.isDirty ?? rawScan?.isDirty ?? false,
    ahead: derived?.ahead ?? rawScan?.ahead ?? 0,
    behind: derived?.behind ?? rawScan?.behind ?? 0,
    framework: derived?.framework ?? rawScan?.framework ?? null,
    branchName: derived?.branchName ?? rawScan?.branch ?? null,
    lastCommitDate: derived?.lastCommitDate?.toISOString() ?? rawScan?.lastCommitDate ?? null,
    locEstimate: derived?.locEstimate ?? rawScan?.locEstimate ?? 0,

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

    goal: metadata?.goal ?? null,
    audience: metadata?.audience ?? null,
    successMetrics: metadata?.successMetrics ?? null,
    nextAction: metadata?.nextAction ?? null,
    publishTarget: metadata?.publishTarget ?? null,

    aiInsight: parseAiInsightJson(llm?.aiInsightJson),

    pitch: llm?.pitch ?? null,
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

    lastScanned: scan?.scannedAt?.toISOString() ?? null,
    updatedAt: project.updatedAt.toISOString(),
  };
}
