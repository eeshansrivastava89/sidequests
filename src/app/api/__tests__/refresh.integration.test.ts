import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb } from "@/lib/__tests__/helpers/test-db";
import { SCAN_FIXTURE, DERIVE_FIXTURE, LLM_ENRICHMENT_FIXTURE } from "@/lib/__tests__/helpers/fixtures";

const mockConfig = vi.hoisted(() => ({
  devRoot: "/Users/test/dev",
  excludeDirs: ["node_modules"],
  featureLlm: false,
  featureO1: false,
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

// Mock child_process for pipeline
const mockIO = vi.hoisted(() => ({
  scanOutput: "",
  deriveOutput: "",
}));

vi.mock("child_process", () => {
  const customPromisify = Symbol.for("nodejs.util.promisify.custom");
  const execFile = () => {};
  (execFile as unknown as Record<symbol, unknown>)[customPromisify] = async () => ({
    stdout: mockIO.scanOutput,
    stderr: "",
  });
  const spawn = () => {
    const handlers: Record<string, Function[]> = {};
    return {
      stdin: {
        write: () => {},
        end: () => {
          setTimeout(() => {
            for (const fn of handlers["data"] ?? []) fn(Buffer.from(mockIO.deriveOutput));
            for (const fn of handlers["close"] ?? []) fn(0);
          }, 5);
        },
      },
      stdout: {
        on: (evt: string, fn: Function) => {
          if (evt === "data") (handlers["data"] ??= []).push(fn);
        },
      },
      stderr: {
        on: (evt: string, fn: Function) => {
          if (evt === "data") (handlers["stderr_data"] ??= []).push(fn);
        },
      },
      on: (evt: string, fn: Function) => {
        if (evt === "close") (handlers["close"] ??= []).push(fn);
        if (evt === "error") (handlers["error"] ??= []).push(fn);
      },
      kill: () => {},
    };
  };
  return { execFile, spawn };
});

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
let refreshPOST: Function;

beforeAll(async () => {
  db = await getTestDb();
  const route = await import("@/app/api/refresh/route");
  refreshPOST = route.POST;
});

beforeEach(async () => {
  mockConfig.featureLlm = false;
  mockIO.scanOutput = JSON.stringify(SCAN_FIXTURE);
  mockIO.deriveOutput = JSON.stringify(DERIVE_FIXTURE);
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
    mockIO.scanOutput = "invalid json{{{";

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
