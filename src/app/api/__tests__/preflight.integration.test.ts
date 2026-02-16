import { describe, it, expect, beforeAll, vi } from "vitest";

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
  ollamaUrl: "",
  mlxUrl: "",
  openrouterApiKey: "",
}));

vi.mock("@/lib/config", () => ({ config: mockConfig }));
vi.mock("@/lib/settings", () => ({
  getSettings: () => ({}),
  clearSettingsCache: () => {},
}));

type RouteHandler = (...args: unknown[]) => unknown;
let preflightGET: RouteHandler;

beforeAll(async () => {
  const route = await import("@/app/api/preflight/route");
  preflightGET = route.GET;
});

describe("GET /api/preflight — Path A (TS-native)", () => {
  it("does NOT include python3 as a required check", async () => {
    const res = await preflightGET();
    const body = await res.json();

    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).not.toContain("python3");
  });

  it("includes git as a required check", async () => {
    const res = await preflightGET();
    const body = await res.json();

    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain("git");
  });

  it("includes only git when LLM is disabled", async () => {
    mockConfig.featureLlm = false;
    const res = await preflightGET();
    const body = await res.json();

    expect(body.checks).toHaveLength(1);
    expect(body.checks[0].name).toBe("git");
  });

  it("includes provider check when LLM is enabled", async () => {
    mockConfig.featureLlm = true;
    mockConfig.llmProvider = "claude-cli";
    const res = await preflightGET();
    const body = await res.json();

    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain("git");
    expect(names).toContain("claude");
  });
});
