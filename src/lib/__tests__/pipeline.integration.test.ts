import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb } from "./helpers/test-db";
import {
  SCAN_FIXTURE,
  DERIVE_FIXTURE,
  SCAN_FIXTURE_REDUCED,
  DERIVE_FIXTURE_REDUCED,
  LLM_ENRICHMENT_FIXTURE,
} from "./helpers/fixtures";
import type { PipelineEvent } from "@/lib/pipeline";

// -- Mocks --

const mockConfig = vi.hoisted(() => ({
  devRoot: "/Users/test/dev",
  excludeDirs: ["node_modules"],
  featureLlm: false,
  sanitizePaths: false,
  llmProvider: "claude-cli",
  llmAllowUnsafe: false,
  llmOverwriteMetadata: false,
  llmConcurrency: 3,
  llmDebug: false,
}));

vi.mock("@/lib/config", () => ({ config: mockConfig }));
vi.mock("@/lib/settings", () => ({
  getSettings: () => ({}),
  clearSettingsCache: () => {},
}));

// Hoisted mutable mock return values for TS-native pipeline modules
const mockPipeline = vi.hoisted(() => ({
  scanResult: {} as Record<string, unknown>,
  deriveResult: {} as Record<string, unknown>,
}));

vi.mock("@/lib/pipeline-native/scan", () => ({
  scanAll: () => mockPipeline.scanResult,
}));

vi.mock("@/lib/pipeline-native/derive", () => ({
  deriveAll: () => mockPipeline.deriveResult,
}));

// Mock LLM provider
const mockEnrich = vi.fn().mockResolvedValue(LLM_ENRICHMENT_FIXTURE);

vi.mock("@/lib/llm", () => ({
  getLlmProvider: () => {
    if (!mockConfig.featureLlm) return null;
    return { name: "test-provider", enrich: mockEnrich };
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
let runRefreshPipeline: typeof import("@/lib/pipeline").runRefreshPipeline;

beforeAll(async () => {
  db = await getTestDb();
  // Import pipeline after db is initialized — pipeline.ts will pick up
  // the same globalThis.prisma singleton pointing at test.db
  const mod = await import("@/lib/pipeline");
  runRefreshPipeline = mod.runRefreshPipeline;
});

beforeEach(async () => {
  mockConfig.featureLlm = false;
  mockConfig.llmOverwriteMetadata = false;
  mockPipeline.scanResult = SCAN_FIXTURE;
  mockPipeline.deriveResult = DERIVE_FIXTURE;
  mockEnrich.mockClear();
  mockEnrich.mockResolvedValue(LLM_ENRICHMENT_FIXTURE);
  await cleanDb(db);
});

describe("pipeline integration — store phase", () => {
  it("full pipeline happy path (LLM disabled): creates Project, Scan, Derived", async () => {
    const events: PipelineEvent[] = [];
    const result = await runRefreshPipeline((e) => events.push(e), undefined, { skipLlm: true });

    expect(result.projectCount).toBe(3);

    const projects = await db.project.findMany();
    expect(projects).toHaveLength(3);

    const scans = await db.scan.findMany();
    expect(scans).toHaveLength(3);

    const derived = await db.derived.findMany();
    expect(derived).toHaveLength(3);

    // No LLM records
    const llms = await db.llm.findMany();
    expect(llms).toHaveLength(0);
  });

  it("full pipeline happy path (LLM enabled): creates all 7 models", async () => {
    mockConfig.featureLlm = true;
    const result = await runRefreshPipeline();

    expect(result.projectCount).toBe(3);

    const projects = await db.project.findMany();
    expect(projects).toHaveLength(3);

    const llms = await db.llm.findMany();
    expect(llms).toHaveLength(3);

    const metadata = await db.metadata.findMany();
    expect(metadata).toHaveLength(3);

    const activities = await db.activity.findMany();
    expect(activities).toHaveLength(3);
  });

  it("upsert creates new project, then updates existing (ID preserved)", async () => {
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });
    const first = await db.project.findFirst({ where: { pathHash: "hash-aaa" } });

    // Run again — should update, not create duplicate
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });
    const projects = await db.project.findMany({ where: { pathHash: "hash-aaa" } });
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(first.id);
  });

  it("scan records contain valid rawJson and SHA-256 rawJsonHash", async () => {
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });
    const scan = await db.scan.findFirst();

    expect(scan).not.toBeNull();
    const parsed = JSON.parse(scan.rawJson);
    expect(parsed.name).toBeDefined();

    expect(scan.rawJsonHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("derived records have correct scores and promoted columns", async () => {
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });
    const proj = await db.project.findFirst({ where: { pathHash: "hash-aaa" } });
    const derived = await db.derived.findFirst({ where: { projectId: proj.id } });

    expect(derived.statusAuto).toBe("active");
    expect(derived.healthScoreAuto).toBe(82);
    expect(derived.hygieneScoreAuto).toBe(90);
    expect(derived.momentumScoreAuto).toBe(75);
    expect(derived.isDirty).toBe(false);
    expect(derived.ahead).toBe(0);
    expect(derived.framework).toBe("next");
    expect(derived.locEstimate).toBe(5000);
  });
});

describe("pipeline integration — soft-prune", () => {
  it("missing project gets prunedAt set", async () => {
    // First run: 3 projects
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });

    // Second run: only 2 projects (proj-b missing)
    mockPipeline.scanResult = SCAN_FIXTURE_REDUCED;
    mockPipeline.deriveResult = DERIVE_FIXTURE_REDUCED;
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });

    const pruned = await db.project.findFirst({ where: { pathHash: "hash-bbb" } });
    expect(pruned.prunedAt).not.toBeNull();
  });

  it("returning project gets prunedAt cleared", async () => {
    // First run: 3 projects
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });

    // Second run: only 2 (prune proj-b)
    mockPipeline.scanResult = SCAN_FIXTURE_REDUCED;
    mockPipeline.deriveResult = DERIVE_FIXTURE_REDUCED;
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });

    const pruned = await db.project.findFirst({ where: { pathHash: "hash-bbb" } });
    expect(pruned.prunedAt).not.toBeNull();

    // Third run: all 3 again
    mockPipeline.scanResult = SCAN_FIXTURE;
    mockPipeline.deriveResult = DERIVE_FIXTURE;
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });

    const restored = await db.project.findFirst({ where: { pathHash: "hash-bbb" } });
    expect(restored.prunedAt).toBeNull();
  });
});

describe("pipeline integration — LLM enrichment", () => {
  it("success creates Llm + Metadata records", async () => {
    mockConfig.featureLlm = true;
    await runRefreshPipeline();

    const llm = await db.llm.findFirst();
    expect(llm).not.toBeNull();
    expect(llm.purpose).toBe(LLM_ENRICHMENT_FIXTURE.purpose);
    expect(JSON.parse(llm.tagsJson)).toEqual(LLM_ENRICHMENT_FIXTURE.tags);

    const meta = await db.metadata.findFirst();
    expect(meta).not.toBeNull();
    expect(meta.goal).toBe(LLM_ENRICHMENT_FIXTURE.goal);
  });

  it("failure for one project doesn't block others", async () => {
    mockConfig.featureLlm = true;
    let callCount = 0;
    mockEnrich.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) throw new Error("LLM fail");
      return LLM_ENRICHMENT_FIXTURE;
    });

    const events: PipelineEvent[] = [];
    await runRefreshPipeline((e) => events.push(e));

    const doneEvent = events.find((e) => e.type === "done") as Extract<PipelineEvent, { type: "done" }>;
    expect(doneEvent.llmFailed).toBe(1);
    expect(doneEvent.llmSucceeded).toBe(2);
  });

  it("respects llmOverwriteMetadata=false (preserves existing non-empty fields)", async () => {
    mockConfig.featureLlm = true;
    mockConfig.llmOverwriteMetadata = false;

    // First run seeds metadata from LLM
    await runRefreshPipeline();

    // Manually update goal to something different
    const meta = await db.metadata.findFirst();
    await db.metadata.update({ where: { id: meta.id }, data: { goal: "My custom goal" } });

    // Second run should NOT overwrite
    await runRefreshPipeline();

    const updated = await db.metadata.findFirst({ where: { id: meta.id } });
    expect(updated.goal).toBe("My custom goal");
  });

  it("respects llmOverwriteMetadata=true (overwrites)", async () => {
    mockConfig.featureLlm = true;
    mockConfig.llmOverwriteMetadata = false;

    // First run
    await runRefreshPipeline();
    const meta = await db.metadata.findFirst();
    await db.metadata.update({ where: { id: meta.id }, data: { goal: "My custom goal" } });

    // Second run with overwrite=true
    mockConfig.llmOverwriteMetadata = true;
    await runRefreshPipeline();

    const updated = await db.metadata.findFirst({ where: { id: meta.id } });
    expect(updated.goal).toBe(LLM_ENRICHMENT_FIXTURE.goal);
  });
});

describe("pipeline integration — activity & cleanup", () => {
  it("logs one activity per project per run", async () => {
    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });
    const activities = await db.activity.findMany();
    expect(activities).toHaveLength(3);
    expect(activities[0].type).toBe("scan");
  });

  it("deletes activity records older than 90 days", async () => {
    // Seed an old activity
    const proj = await db.project.create({
      data: { name: "old", pathHash: "h-old", pathDisplay: "/dev/old" },
    });
    await db.activity.create({
      data: {
        projectId: proj.id,
        type: "scan",
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      },
    });

    const before = await db.activity.count();
    expect(before).toBe(1);

    await runRefreshPipeline(() => {}, undefined, { skipLlm: true });

    // The old activity should be deleted, new ones added
    const oldActivities = await db.activity.findMany({
      where: { projectId: proj.id },
    });
    // The old one gets deleted but a new scan activity may be created if proj is in scan
    // Since "old" isn't in scan data, its old activity just gets deleted
    expect(oldActivities).toHaveLength(0);
  });
});

describe("pipeline integration — events", () => {
  it("emits correct sequence of events", async () => {
    const events: PipelineEvent[] = [];
    await runRefreshPipeline((e) => events.push(e), undefined, { skipLlm: true });

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("scan_start");
    expect(types[1]).toBe("scan_complete");
    expect(types[2]).toBe("derive_start");
    expect(types[3]).toBe("derive_complete");

    // project_start/project_complete pairs for 3 projects
    const projectStarts = events.filter((e) => e.type === "project_start");
    expect(projectStarts).toHaveLength(3);

    const last = events[events.length - 1];
    expect(last.type).toBe("done");
  });

  it("done event has correct counts and positive durationMs", async () => {
    const events: PipelineEvent[] = [];
    await runRefreshPipeline((e) => events.push(e), undefined, { skipLlm: true });

    const done = events.find((e) => e.type === "done") as Extract<PipelineEvent, { type: "done" }>;
    expect(done.projectCount).toBe(3);
    expect(done.llmSkipped).toBe(3);
    expect(done.llmSucceeded).toBe(0);
    expect(done.llmFailed).toBe(0);
    expect(done.durationMs).toBeGreaterThan(0);
  });
});

describe("pipeline integration — abort", () => {
  it("AbortSignal stops pipeline mid-store", async () => {
    const controller = new AbortController();
    const events: PipelineEvent[] = [];

    // Abort after the first project_complete
    const emit = (e: PipelineEvent) => {
      events.push(e);
      if (e.type === "project_complete" && (e as { step: string }).step === "store") {
        controller.abort();
      }
    };

    await runRefreshPipeline(emit, controller.signal, { skipLlm: true });

    // Should have stored fewer than 3 projects
    const projects = await db.project.findMany();
    expect(projects.length).toBeLessThan(3);
  });
});
