import { describe, it, expect, beforeAll, vi } from "vitest";

const mockConfig = vi.hoisted(() => ({
  devRoot: "/Users/test/dev",
  excludeDirs: ["node_modules"],
  sanitizePaths: false,
  llmProvider: "none",
  llmAllowUnsafe: false,
  llmOverwriteMetadata: false,

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

  it("includes git + gh + all provider checks when llmProvider is none", async () => {
    mockConfig.llmProvider = "none";
    const res = await preflightGET();
    const body = await res.json();

    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain("git");
    expect(names).toContain("gh");
    // All providers shown as discovery/status dashboard (all optional tier)
    expect(names).toContain("claude");
    expect(names).toContain("openrouter");
    expect(names).toContain("ollama");
    expect(names).toContain("mlx");
    expect(names).toContain("codex");
  });

  it("includes provider check when llmProvider is configured", async () => {
    mockConfig.llmProvider = "claude-cli";
    const res = await preflightGET();
    const body = await res.json();

    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain("git");
    expect(names).toContain("claude");
  });
});
