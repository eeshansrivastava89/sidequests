import type { LlmEnrichment, LlmStatus } from "@/lib/llm/provider";

const NOW = "2025-06-01T12:00:00Z";

// -- Scan fixtures (what scan.py returns) --

export const SCAN_FIXTURE = {
  scannedAt: NOW,
  projectCount: 3,
  projects: [
    {
      name: "proj-a",
      path: "/Users/test/dev/proj-a",
      pathHash: "hash-aaa",
      isRepo: true,
      branch: "main",
      isDirty: false,
      ahead: 0,
      behind: 0,
      framework: "next",
      lastCommitDate: NOW,
      locEstimate: 5000,
      description: "Project A description",
      commitCount: 100,
      daysInactive: 1,
      remoteUrl: "https://github.com/test/proj-a",
      lastCommitMessage: "feat: init",
      languages: { primary: "typescript", detected: ["typescript", "css"] },
      files: { "README.md": true },
      cicd: {},
      deployment: {},
      todoCount: 2,
      fixmeCount: 0,
      recentCommits: [{ hash: "abc123", message: "feat: init", date: NOW }],
      scripts: ["dev", "build", "test"],
      services: [],
      packageManager: "npm",
      branchCount: 3,
      stashCount: 0,
      license: true,
      liveUrl: null,
    },
    {
      name: "proj-b",
      path: "/Users/test/dev/proj-b",
      pathHash: "hash-bbb",
      isRepo: true,
      branch: "develop",
      isDirty: true,
      ahead: 2,
      behind: 1,
      framework: "react",
      lastCommitDate: "2025-05-20T08:00:00Z",
      locEstimate: 3000,
      description: "Project B description",
      commitCount: 50,
      daysInactive: 12,
      remoteUrl: null,
      lastCommitMessage: "fix: bug",
      languages: { primary: "javascript", detected: ["javascript"] },
      files: {},
      cicd: {},
      deployment: {},
      todoCount: 0,
      fixmeCount: 1,
      recentCommits: [],
      scripts: ["start"],
      services: ["redis"],
      packageManager: "yarn",
      branchCount: 1,
      stashCount: 2,
      license: false,
      liveUrl: "http://localhost:3001",
    },
    {
      name: "proj-c",
      path: "/Users/test/dev/proj-c",
      pathHash: "hash-ccc",
      isRepo: false,
      branch: null,
      isDirty: false,
      ahead: 0,
      behind: 0,
      framework: null,
      lastCommitDate: null,
      locEstimate: 200,
      description: null,
      commitCount: 0,
      daysInactive: null,
      remoteUrl: null,
      lastCommitMessage: null,
      languages: { primary: "python", detected: ["python"] },
      files: {},
      cicd: {},
      deployment: {},
      todoCount: 0,
      fixmeCount: 0,
      recentCommits: [],
      scripts: [],
      services: [],
      packageManager: null,
      branchCount: 0,
      stashCount: 0,
      license: false,
      liveUrl: null,
    },
  ],
};

// -- Derive fixtures (what derive.py returns) --

export const DERIVE_FIXTURE = {
  derivedAt: NOW,
  projects: [
    {
      pathHash: "hash-aaa",
      statusAuto: "active",
      healthScoreAuto: 82,
      hygieneScoreAuto: 90,
      momentumScoreAuto: 75,
      scoreBreakdownJson: { hygiene: { readme: 20 }, momentum: { recency: 30 } },
      tags: ["typescript", "next", "fullstack"],
    },
    {
      pathHash: "hash-bbb",
      statusAuto: "completed",
      healthScoreAuto: 45,
      hygieneScoreAuto: 30,
      momentumScoreAuto: 20,
      scoreBreakdownJson: { hygiene: { readme: 0 }, momentum: { recency: 5 } },
      tags: ["javascript", "react"],
    },
    {
      pathHash: "hash-ccc",
      statusAuto: "archived",
      healthScoreAuto: 10,
      hygieneScoreAuto: 5,
      momentumScoreAuto: 0,
      scoreBreakdownJson: {},
      tags: ["python"],
    },
  ],
};

// -- Reduced scan (proj-b removed — for soft-prune tests) --

export const SCAN_FIXTURE_REDUCED = {
  scannedAt: NOW,
  projectCount: 2,
  projects: [SCAN_FIXTURE.projects[0], SCAN_FIXTURE.projects[2]],
};

export const DERIVE_FIXTURE_REDUCED = {
  derivedAt: NOW,
  projects: [DERIVE_FIXTURE.projects[0], DERIVE_FIXTURE.projects[2]],
};

// -- LLM enrichment fixture --

export const LLM_ENRICHMENT_FIXTURE: LlmEnrichment = {
  summary: "A full-stack Next.js dashboard for project management with scan pipeline and LLM enrichment",
  nextAction: "Write documentation and add integration tests",
  status: "building" as LlmStatus,
  statusReason: "Active development with frequent commits and features in progress",
  tags: ["typescript", "next", "dashboard"],
  insights: [
    { text: "Add unit tests to prevent regressions as the codebase grows", severity: "amber" },
    { text: "Set up CI/CD to automate builds and catch issues early", severity: "red" },
    { text: "Consider adding a second maintainer to reduce bus factor risk", severity: "amber" },
  ],
};

// -- DB seeding helpers --

type PrismaClient = {
  project: { create: (args: unknown) => Promise<{ id: string }> };
  scan: { create: (args: unknown) => Promise<unknown> };
  derived: { create: (args: unknown) => Promise<unknown> };
  llm: { create: (args: unknown) => Promise<unknown> };
  override: { create: (args: unknown) => Promise<unknown> };
  metadata: { create: (args: unknown) => Promise<unknown> };
};

interface SeedOverrides {
  name?: string;
  pathHash?: string;
  pathDisplay?: string;
  pinned?: boolean;
  prunedAt?: Date | null;
  scan?: Record<string, unknown> | false;
  derived?: {
    statusAuto?: string;
    healthScoreAuto?: number;
    hygieneScoreAuto?: number;
    momentumScoreAuto?: number;
    scoreBreakdownJson?: string;
    derivedJson?: string;
    isDirty?: boolean;
    dirtyFileCount?: number;
    ahead?: number;
    behind?: number;
    framework?: string | null;
    branchName?: string | null;
    lastCommitDate?: Date | null;
    locEstimate?: number;
  } | false;
  llm?: {
    summary?: string;
    nextAction?: string;
    llmStatus?: string;
    statusReason?: string;
    risksJson?: string;
    tagsJson?: string;
    recommendationsJson?: string;
    // Legacy fields
    purpose?: string;
    notableFeaturesJson?: string;
    pitch?: string | null;
    aiInsightJson?: string | null;
  } | false;
  override?: {
    statusOverride?: string | null;
    purposeOverride?: string | null;
    tagsOverride?: string | null;
    notesOverride?: string | null;
  } | false;
  metadata?: {
    goal?: string | null;
    audience?: string | null;
    successMetrics?: string | null;
    nextAction?: string | null;
    publishTarget?: string | null;
  } | false;
}

/**
 * Seed a project with all 5 relations. Pass `false` to skip a relation.
 * Returns the created project ID.
 */
export async function seedProject(
  db: PrismaClient,
  overrides: SeedOverrides = {},
): Promise<string> {
  const project = await db.project.create({
    data: {
      name: overrides.name ?? "test-project",
      pathHash: overrides.pathHash ?? `hash-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      pathDisplay: overrides.pathDisplay ?? "/Users/test/dev/test-project",
      pinned: overrides.pinned ?? false,
      prunedAt: overrides.prunedAt ?? null,
    },
  }) as { id: string };

  if (overrides.scan !== false) {
    const scanData = overrides.scan ?? SCAN_FIXTURE.projects[0];
    await db.scan.create({
      data: {
        projectId: project.id,
        rawJson: JSON.stringify(scanData),
        rawJsonHash: "test-hash",
        scannedAt: new Date(NOW),
      },
    });
  }

  if (overrides.derived !== false) {
    await db.derived.create({
      data: {
        projectId: project.id,
        statusAuto: overrides.derived?.statusAuto ?? "active",
        healthScoreAuto: overrides.derived?.healthScoreAuto ?? 82,
        hygieneScoreAuto: overrides.derived?.hygieneScoreAuto ?? 90,
        momentumScoreAuto: overrides.derived?.momentumScoreAuto ?? 75,
        scoreBreakdownJson: overrides.derived?.scoreBreakdownJson ?? "{}",
        derivedJson: overrides.derived?.derivedJson ?? JSON.stringify({ tags: ["typescript"] }),
        isDirty: overrides.derived?.isDirty ?? false,
        dirtyFileCount: overrides.derived?.dirtyFileCount ?? 0,
        ahead: overrides.derived?.ahead ?? 0,
        behind: overrides.derived?.behind ?? 0,
        framework: overrides.derived?.framework ?? "next",
        branchName: overrides.derived?.branchName ?? "main",
        lastCommitDate: overrides.derived?.lastCommitDate ?? new Date(NOW),
        locEstimate: overrides.derived?.locEstimate ?? 5000,
      },
    });
  }

  if (overrides.llm !== false) {
    await db.llm.create({
      data: {
        projectId: project.id,
        summary: overrides.llm?.summary ?? "Test project summary",
        nextAction: overrides.llm?.nextAction ?? "Review and improve tests",
        llmStatus: overrides.llm?.llmStatus ?? "building",
        statusReason: overrides.llm?.statusReason ?? "Active development",
        risksJson: overrides.llm?.risksJson ?? JSON.stringify(["No tests"]),
        tagsJson: overrides.llm?.tagsJson ?? JSON.stringify(["typescript"]),
        recommendationsJson: overrides.llm?.recommendationsJson ?? JSON.stringify(["Add tests"]),
        insightsJson: overrides.llm?.insightsJson ?? JSON.stringify(["Add tests to improve coverage"]),
        framework: overrides.llm?.framework ?? "Next.js",
        primaryLanguage: overrides.llm?.primaryLanguage ?? "TypeScript",
        // Legacy fields
        purpose: overrides.llm?.purpose ?? "Test purpose",
        notableFeaturesJson: overrides.llm?.notableFeaturesJson ?? JSON.stringify(["SSR"]),
        pitch: overrides.llm?.pitch ?? "A great project",
        aiInsightJson: overrides.llm?.aiInsightJson ?? null,
      },
    });
  }

  if (overrides.override !== false && overrides.override) {
    await db.override.create({
      data: {
        projectId: project.id,
        statusOverride: overrides.override.statusOverride ?? null,
        purposeOverride: overrides.override.purposeOverride ?? null,
        tagsOverride: overrides.override.tagsOverride ?? null,
        notesOverride: overrides.override.notesOverride ?? null,
      },
    });
  }

  if (overrides.metadata !== false && overrides.metadata) {
    await db.metadata.create({
      data: {
        projectId: project.id,
        goal: overrides.metadata.goal ?? null,
        audience: overrides.metadata.audience ?? null,
        successMetrics: overrides.metadata.successMetrics ?? null,
        nextAction: overrides.metadata.nextAction ?? null,
        publishTarget: overrides.metadata.publishTarget ?? null,
      },
    });
  }

  return project.id;
}

/**
 * Seed a minimal project (Project record only, no relations).
 */
export async function seedMinimalProject(
  db: PrismaClient,
  pathHash: string,
  name: string,
): Promise<string> {
  const project = await db.project.create({
    data: {
      name,
      pathHash,
      pathDisplay: `/Users/test/dev/${name}`,
    },
  }) as { id: string };
  return project.id;
}
