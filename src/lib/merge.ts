import { db } from "./db";
import { config } from "./config";
import type { Project } from "@/generated/prisma/client";

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

  // O-1 evidence (gated)
  evidence: Record<string, unknown> | null;
  outcomes: Record<string, unknown> | null;

  // New Phase 29 fields
  pitch: string | null;
  liveUrl: string | null;
  llmGeneratedAt: string | null;

  // Timestamps
  lastScanned: string | null;
  updatedAt: string;
}

export interface RawScan {
  isRepo: boolean;
  lastCommitDate: string | null;
  lastCommitMessage: string | null;
  branch: string | null;
  remoteUrl: string | null;
  commitCount: number;
  daysInactive: number | null;
  isDirty: boolean;
  languages: { primary: string | null; detected: string[] };
  files: Record<string, boolean>;
  cicd: Record<string, boolean>;
  deployment: Record<string, boolean>;
  todoCount: number;
  fixmeCount: number;
  description: string | null;
  recentCommits: Array<{ hash: string; message: string; date: string }>;
  scripts: string[];
  services: string[];
  packageManager: string | null;
  branchCount: number;
  stashCount: number;
  locEstimate: number;
  license: boolean;
  ahead: number;
  behind: number;
  framework: string | null;
  liveUrl: string | null;
}

function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function sanitizePath(pathDisplay: string): string {
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
    include: { scan: true, derived: true, llm: true, override: true, metadata: true },
  });

  if (!project) return null;
  return buildMergedView(project);
}

export async function mergeAllProjects(): Promise<MergedProject[]> {
  const projects = await db.project.findMany({
    where: { prunedAt: null },
    include: { scan: true, derived: true, llm: true, override: true, metadata: true },
    orderBy: { name: "asc" },
  });

  return projects.map(buildMergedView);
}

type ProjectWithRelations = Project & {
  scan: { rawJson: string; scannedAt: Date } | null;
  derived: {
    statusAuto: string;
    healthScoreAuto: number;
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
    evidenceJson: string | null;
    outcomesJson: string | null;
  } | null;
};

function buildMergedView(project: ProjectWithRelations): MergedProject {
  const { scan, derived, llm, override, metadata } = project;

  const rawScan = parseJson<RawScan | null>(scan?.rawJson, null);
  const derivedData = parseJson<Record<string, unknown>>(derived?.derivedJson, {});

  // Priority: Override > Metadata > Derived > LLM > Scan
  const status =
    override?.statusOverride ??
    derived?.statusAuto ??
    "archived";

  const healthScore = derived?.healthScoreAuto ?? 0;

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

    evidence: config.featureO1 ? parseJson(metadata?.evidenceJson, null) : null,
    outcomes: config.featureO1 ? parseJson(metadata?.outcomesJson, null) : null,

    pitch: llm?.pitch ?? null,
    liveUrl: rawScan?.liveUrl ?? null,
    llmGeneratedAt: llm?.generatedAt?.toISOString() ?? null,

    lastScanned: scan?.scannedAt?.toISOString() ?? null,
    updatedAt: project.updatedAt.toISOString(),
  };
}
