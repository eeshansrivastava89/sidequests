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

  // Raw scan data
  scan: RawScan | null;

  // Metadata (workflow fields)
  goal: string | null;
  audience: string | null;
  successMetrics: string | null;
  nextAction: string | null;
  publishTarget: string | null;

  // O-1 evidence (gated)
  evidence: Record<string, unknown> | null;
  outcomes: Record<string, unknown> | null;

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
  languages: { primary: string | null; detected: string[] };
  files: Record<string, boolean>;
  cicd: Record<string, boolean>;
  deployment: Record<string, boolean>;
  todoCount: number;
  fixmeCount: number;
  description: string | null;
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
    include: { scan: true, derived: true, llm: true, override: true, metadata: true },
    orderBy: { name: "asc" },
  });

  return projects.map(buildMergedView);
}

type ProjectWithRelations = Project & {
  scan: { rawJson: string; scannedAt: Date } | null;
  derived: { statusAuto: string; healthScoreAuto: number; derivedJson: string } | null;
  llm: {
    purpose: string | null;
    tagsJson: string | null;
    notableFeaturesJson: string | null;
    recommendationsJson: string | null;
  } | null;
  override: {
    statusOverride: string | null;
    purposeOverride: string | null;
    tagsOverride: string | null;
    notesOverride: string | null;
    manualJson: string | null;
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
    parseJson<string[]>(derivedData.tags as string | undefined, []);

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

    scan: rawScan,

    goal: metadata?.goal ?? null,
    audience: metadata?.audience ?? null,
    successMetrics: metadata?.successMetrics ?? null,
    nextAction: metadata?.nextAction ?? null,
    publishTarget: metadata?.publishTarget ?? null,

    evidence: config.featureO1 ? parseJson(metadata?.evidenceJson, null) : null,
    outcomes: config.featureO1 ? parseJson(metadata?.outcomesJson, null) : null,

    lastScanned: scan?.scannedAt?.toISOString() ?? null,
    updatedAt: project.updatedAt.toISOString(),
  };
}
