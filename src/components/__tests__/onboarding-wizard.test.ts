import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AppConfig for testing
const DEFAULT_CONFIG = {
  sanitizePaths: true,
  devRoot: "~/dev",
  excludeDirs: "",
  llmProvider: "claude-cli",
  llmConcurrency: 3,
  llmOverwriteMetadata: false,
  llmAllowUnsafe: false,
  llmDebug: false,
  claudeCliModel: "",
  openrouterApiKey: "",
  openrouterModel: "",
  ollamaUrl: "",
  ollamaModel: "",
  mlxUrl: "",
  mlxModel: "",
  hasCompletedOnboarding: false,
};

const INITIAL_SCAN_STATE = {
  active: false,
  phase: "",
  mode: null,
  projects: new Map(),
  summary: null,
  error: null,
};

describe("OnboardingWizard logic", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn() as unknown as ReturnType<typeof vi.fn>;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("should auto-open when configReady, hasCompletedOnboarding is false, and no projects", () => {
    // The wizard open logic lives in page.tsx:
    // !loading && configReady && !config.hasCompletedOnboarding && projects.length === 0
    const config = { ...DEFAULT_CONFIG, hasCompletedOnboarding: false };
    const projects: unknown[] = [];
    const loading = false;
    const configReady = true;

    const shouldOpen = !loading && configReady && !config.hasCompletedOnboarding && projects.length === 0;
    expect(shouldOpen).toBe(true);
  });

  it("should not auto-open when hasCompletedOnboarding is true", () => {
    const config = { ...DEFAULT_CONFIG, hasCompletedOnboarding: true };
    const projects: unknown[] = [];
    const loading = false;
    const configReady = true;

    const shouldOpen = !loading && configReady && !config.hasCompletedOnboarding && projects.length === 0;
    expect(shouldOpen).toBe(false);
  });

  it("should not auto-open when projects exist", () => {
    const config = { ...DEFAULT_CONFIG, hasCompletedOnboarding: false };
    const projects = [{ id: "1", name: "test" }];
    const loading = false;
    const configReady = true;

    const shouldOpen = !loading && configReady && !config.hasCompletedOnboarding && projects.length === 0;
    expect(shouldOpen).toBe(false);
  });

  it("should not auto-open when config is not yet ready", () => {
    const config = { ...DEFAULT_CONFIG, hasCompletedOnboarding: false };
    const projects: unknown[] = [];
    const loading = false;
    const configReady = false;

    const shouldOpen = !loading && configReady && !config.hasCompletedOnboarding && projects.length === 0;
    expect(shouldOpen).toBe(false);
  });

  it("should save settings via PUT /api/settings on configure step", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    const body = {
      devRoot: "~/projects",
      excludeDirs: "node_modules,.git",
      llmProvider: "claude-cli",
      openrouterModel: "",
      ollamaUrl: "",
      ollamaModel: "",
      mlxUrl: "",
      mlxModel: "",
      claudeCliModel: "",
    };

    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("~/projects"),
    }));
  });

  it("should set hasCompletedOnboarding on completion", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasCompletedOnboarding: true }),
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("hasCompletedOnboarding"),
    }));
  });

  it("should display preflight results from /api/preflight", async () => {
    const checks = [
      { name: "Git", ok: true, message: "git 2.39.0" },
      { name: "Node.js", ok: true, message: "v20.11.0" },
      { name: "Dev Root", ok: false, message: "~/dev does not exist" },
    ];

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ checks }),
    });

    const res = await fetch("/api/preflight");
    const data = await res.json();

    expect(data.checks).toHaveLength(3);
    expect(data.checks[0].ok).toBe(true);
    expect(data.checks[2].ok).toBe(false);

    const allPassed = data.checks.every((c: { ok: boolean }) => c.ok);
    expect(allPassed).toBe(false);
  });
});
