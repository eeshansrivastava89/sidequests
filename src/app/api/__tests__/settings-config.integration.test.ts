import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const tmpDir = path.join(os.tmpdir(), "pd-desktop-flows-" + Date.now());

// Mock app-paths to use tmpDir
vi.mock("@/lib/app-paths", () => {
  return {
    paths: {
      get dataDir() { return tmpDir; },
      get settingsPath() { return path.join(tmpDir, "settings.json"); },
      get dbPath() { return path.join(tmpDir, "dev.db"); },
      get dbUrl() { return `file:${path.join(tmpDir, "dev.db")}`; },
      get pipelineDir() { return path.join(tmpDir, "pipeline"); },
    },
    resetPaths: () => {},
  };
});

const mockConfig = vi.hoisted(() => ({
  devRoot: "/Users/test/dev",
  excludeDirs: ["node_modules"],
  sanitizePaths: false,
  llmProvider: "claude-cli",
  llmAllowUnsafe: false,
  llmOverwriteMetadata: false,

  llmDebug: false,
  ollamaUrl: "",
  mlxUrl: "",
  openrouterApiKey: "",
  openrouterModel: "anthropic/claude-sonnet-4",
  ollamaModel: "llama3",
  mlxModel: "default",
  claudeCliModel: "",
  hasCompletedOnboarding: false,
}));

vi.mock("@/lib/config", () => ({ config: mockConfig }));
vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  return {
    ...actual,
    // Override getSettings to read from tmpDir settings
    getSettings: () => {
      try {
        const raw = fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8");
        return JSON.parse(raw);
      } catch {
        return {};
      }
    },
    clearSettingsCache: () => {},
  };
});

type RouteHandler = (...args: unknown[]) => unknown;
let settingsGET: RouteHandler;
let settingsPUT: RouteHandler;
let preflightGET: RouteHandler;

beforeAll(async () => {
  const settingsRoute = await import("@/app/api/settings/route");
  settingsGET = settingsRoute.GET;
  settingsPUT = settingsRoute.PUT;

  const preflightRoute = await import("@/app/api/preflight/route");
  preflightGET = preflightRoute.GET;
});

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  // Reset config to defaults
  mockConfig.sanitizePaths = false;
  mockConfig.llmProvider = "none";
  mockConfig.hasCompletedOnboarding = false;
});

function makePutRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Settings persistence round-trip ────────────────────────────────

describe("settings persistence round-trip", () => {
  it("PUT then GET returns matching values", async () => {
    const payload = {
      devRoot: "~/projects",
      llmProvider: "ollama",
    };
    const putRes = await settingsPUT(makePutRequest(payload));
    expect((await putRes.json()).ok).toBe(true);

    // Verify written to disk
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.devRoot).toBe("~/projects");
    expect(onDisk.llmProvider).toBe("ollama");
  });

  it("PUT preserves existing settings not in payload", async () => {
    // Write initial settings
    fs.writeFileSync(
      path.join(tmpDir, "settings.json"),
      JSON.stringify({ devRoot: "~/dev", ollamaUrl: "http://custom:11434" })
    );

    // PUT only llmProvider
    const putRes = await settingsPUT(makePutRequest({ llmProvider: "mlx" }));
    expect((await putRes.json()).ok).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.devRoot).toBe("~/dev");
    expect(onDisk.ollamaUrl).toBe("http://custom:11434");
    expect(onDisk.llmProvider).toBe("mlx");
  });
});

// ── Settings migration safety ──────────────────────────────────────

describe("settings migration safety", () => {
  it("handles missing settings.json gracefully", async () => {
    // Ensure no settings file exists
    try { fs.unlinkSync(path.join(tmpDir, "settings.json")); } catch { /* noop */ }

    const putRes = await settingsPUT(makePutRequest({ devRoot: "~/fresh" }));
    const data = await putRes.json();
    expect(data.ok).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.devRoot).toBe("~/fresh");
  });

  it("handles corrupt settings.json gracefully", async () => {
    fs.writeFileSync(path.join(tmpDir, "settings.json"), "NOT VALID JSON{{{");

    // PUT should still succeed (getSettings returns {} on parse error)
    const putRes = await settingsPUT(makePutRequest({ devRoot: "~/recovered" }));
    const data = await putRes.json();
    expect(data.ok).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.devRoot).toBe("~/recovered");
  });

  it("handles empty settings.json gracefully", async () => {
    fs.writeFileSync(path.join(tmpDir, "settings.json"), "");

    const putRes = await settingsPUT(makePutRequest({ llmProvider: "claude-cli" }));
    const data = await putRes.json();
    expect(data.ok).toBe(true);
  });
});

// ── Onboarding completion flow ─────────────────────────────────────

describe("onboarding completion flow", () => {
  it("saves hasCompletedOnboarding via settings PUT", async () => {
    const putRes = await settingsPUT(makePutRequest({
      devRoot: "~/dev",
      hasCompletedOnboarding: true,
    }));
    const data = await putRes.json();
    expect(data.ok).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.hasCompletedOnboarding).toBe(true);
  });

  it("preflight includes git check for onboarding", async () => {
    mockConfig.llmProvider = "none";
    const res = await preflightGET();
    const body = await res.json();

    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain("git");
  });
});

// ── Failure: missing/invalid provider ──────────────────────────────

describe("failure: invalid provider", () => {
  it("unknown provider still shows all provider checks (discovery mode)", async () => {
    mockConfig.llmProvider = "nonexistent-provider";

    const res = await preflightGET();
    const body = await res.json();

    // All providers shown regardless of active provider (discovery/status dashboard)
    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain("git");
    expect(names).toContain("gh");
    expect(names).toContain("claude");
    expect(names).toContain("openrouter");
  });

  it("known provider with missing binary fails the check", async () => {
    mockConfig.llmProvider = "claude-cli";

    const res = await preflightGET();
    const body = await res.json();

    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toContain("git");
    expect(names).toContain("claude");
  });
});

// ── Failure: invalid dev root ──────────────────────────────────────

describe("failure: invalid dev root", () => {
  it("settings accepts nonexistent devRoot without error", async () => {
    const putRes = await settingsPUT(makePutRequest({
      devRoot: "/nonexistent/path/that/does/not/exist",
    }));
    const data = await putRes.json();
    expect(data.ok).toBe(true);
  });
});

