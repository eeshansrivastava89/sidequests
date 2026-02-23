import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb } from "@/lib/__tests__/helpers/test-db";
import { SCAN_FIXTURE, DERIVE_FIXTURE, LLM_ENRICHMENT_FIXTURE } from "@/lib/__tests__/helpers/fixtures";

const mockConfig = vi.hoisted(() => ({
  devRoot: "/Users/test/dev",
  excludeDirs: ["node_modules"],
  sanitizePaths: false,
  llmProvider: "claude-cli",
  llmAllowUnsafe: false,
  llmOverwriteMetadata: false,
  llmDebug: false,
}));

vi.mock("@/lib/config", () => ({ config: mockConfig }));
vi.mock("@/lib/settings", () => ({
  getSettings: () => ({}),
  clearSettingsCache: () => {},
}));

// Mutable mock state — initialized in beforeEach (can't use fixtures in hoisted)
const mockScanProjects = vi.hoisted(() => ({
  dirs: [] as Array<{ name: string; absPath: string; pathHash: string }>,
  projectMap: new Map<string, Record<string, unknown>>(),
  deriveMap: new Map<string, Record<string, unknown>>(),
}));

vi.mock("@/lib/pipeline-native/scan", () => ({
  listProjectDirs: () => mockScanProjects.dirs,
  scanProject: (absPath: string) => mockScanProjects.projectMap.get(absPath) ?? {},
}));

vi.mock("@/lib/pipeline-native/derive", () => ({
  deriveProject: (scanned: Record<string, unknown>) =>
    mockScanProjects.deriveMap.get(scanned.pathHash as string) ?? null,
}));

vi.mock("@/lib/pipeline-native/github", () => ({
  isGhAvailable: () => false,
  fetchGitHubData: () => ({}),
  parseGitHubOwnerRepo: () => null,
}));

vi.mock("@/lib/llm", () => ({
  getLlmProvider: () => {
    if (!mockConfig.llmProvider || mockConfig.llmProvider === "none") return null;
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
  mockConfig.llmProvider = "none";
  mockScanProjects.dirs = SCAN_FIXTURE.projects.map((p) => ({
    name: p.name,
    absPath: p.path,
    pathHash: p.pathHash,
  }));
  mockScanProjects.projectMap = new Map(SCAN_FIXTURE.projects.map((p) => [p.path, p]));
  mockScanProjects.deriveMap = new Map(DERIVE_FIXTURE.projects.map((d) => [d.pathHash, d]));
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
    // Make listProjectDirs throw to simulate a pipeline failure
    mockScanProjects.dirs = null as unknown as typeof mockScanProjects.dirs;

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

  it("no Llm records when llmProvider=none", async () => {
    mockConfig.llmProvider = "none";
    await refreshPOST();

    const llms = await db.llm.findMany();
    expect(llms).toHaveLength(0);
  });
});
