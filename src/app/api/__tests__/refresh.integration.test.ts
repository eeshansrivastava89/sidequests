import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb } from "@/lib/__tests__/helpers/test-db";
import { SCAN_FIXTURE, DERIVE_FIXTURE, LLM_ENRICHMENT_FIXTURE } from "@/lib/__tests__/helpers/fixtures";

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

// Mock TS-native pipeline modules
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

vi.mock("@/lib/llm", () => ({
  getLlmProvider: () => {
    if (!mockConfig.featureLlm) return null;
    return {
      name: "test-provider",
      enrich: async () => LLM_ENRICHMENT_FIXTURE,
    };
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
type RouteHandler = (...args: unknown[]) => unknown;
let refreshPOST: RouteHandler;

beforeAll(async () => {
  db = await getTestDb();
  const route = await import("@/app/api/refresh/route");
  refreshPOST = route.POST;
});

beforeEach(async () => {
  mockConfig.featureLlm = false;
  mockPipeline.scanResult = SCAN_FIXTURE;
  mockPipeline.deriveResult = DERIVE_FIXTURE;
  await cleanDb(db);
});

describe("POST /api/refresh", () => {
  it("returns { ok: true, projectCount } with mocked pipeline", async () => {
    const res = await refreshPOST();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.projectCount).toBe(3);
  });

  it("catches pipeline errors → 500", async () => {
    // Make scanAll throw to simulate a pipeline failure
    mockPipeline.scanResult = null as unknown as Record<string, unknown>;

    const res = await refreshPOST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
  });

  it("data persisted in DB after call", async () => {
    await refreshPOST();

    const projects = await db.project.findMany();
    expect(projects).toHaveLength(3);

    const scans = await db.scan.findMany();
    expect(scans).toHaveLength(3);
  });

  it("no Llm records when featureLlm=false", async () => {
    mockConfig.featureLlm = false;
    await refreshPOST();

    const llms = await db.llm.findMany();
    expect(llms).toHaveLength(0);
  });
});
