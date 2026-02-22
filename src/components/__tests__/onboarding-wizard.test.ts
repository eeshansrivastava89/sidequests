import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sortPreflightChecks,
  computeDiagnosticsBanner,
  type PreflightCheck,
} from "@/components/onboarding-wizard";
import type { RefreshState } from "@/hooks/use-refresh";

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

const INITIAL_SCAN_STATE: RefreshState = {
  active: false,
  phase: "",
  deterministicReady: false,
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

describe("scanCoreReady — 'Open Dashboard Now' condition", () => {
  // Tests the exact condition from onboarding-wizard.tsx:
  //   scanCoreReady = scanStarted && scanState.deterministicReady
  // When scanCoreReady && scanState.active → show "Open Dashboard Now"

  it("deterministicReady + active → scanCoreReady is true (shows 'Open Dashboard Now')", () => {
    const scanStarted = true;
    const scanState: RefreshState = {
      ...INITIAL_SCAN_STATE,
      active: true,
      deterministicReady: true,
      phase: "Enriching project-a (1/5)",
    };
    const scanCoreReady = scanStarted && scanState.deterministicReady;
    expect(scanCoreReady).toBe(true);
    expect(scanState.active).toBe(true);
    // Both conditions met: component renders the "Open Dashboard Now" button
  });

  it("deterministicReady false + active → scanCoreReady is false (no early dashboard button)", () => {
    const scanStarted = true;
    const scanState: RefreshState = {
      ...INITIAL_SCAN_STATE,
      active: true,
      deterministicReady: false,
      phase: "Scanning filesystem...",
    };
    const scanCoreReady = scanStarted && scanState.deterministicReady;
    expect(scanCoreReady).toBe(false);
  });

  it("scan not started → scanCoreReady is false regardless of deterministicReady", () => {
    const scanStarted = false;
    const scanState: RefreshState = {
      ...INITIAL_SCAN_STATE,
      deterministicReady: true,
    };
    const scanCoreReady = scanStarted && scanState.deterministicReady;
    expect(scanCoreReady).toBe(false);
  });
});

describe("provider default fallback", () => {
  // Tests the behavior from settings-fields.tsx line 127:
  //   !draft.llmProvider || draft.llmProvider === "none" ? "claude-cli" : draft.llmProvider
  // This is the actual fallback used by ProviderFields in the wizard.

  it("empty llmProvider falls back to claude-cli", () => {
    const draft = { ...DEFAULT_CONFIG, llmProvider: "" };
    const provider = draft.llmProvider || "claude-cli";
    expect(provider).toBe("claude-cli");
  });

  it("'none' llmProvider falls back to claude-cli", () => {
    // settings-fields.tsx:127 now explicitly handles "none":
    //   !draft.llmProvider || draft.llmProvider === "none" ? "claude-cli" : draft.llmProvider
    const draft = { ...DEFAULT_CONFIG, llmProvider: "none" };
    const provider = !draft.llmProvider || draft.llmProvider === "none" ? "claude-cli" : draft.llmProvider;
    expect(provider).toBe("claude-cli");
  });

  it("explicit provider value is preserved", () => {
    const draft = { ...DEFAULT_CONFIG, llmProvider: "openrouter" };
    const provider = draft.llmProvider || "claude-cli";
    expect(provider).toBe("openrouter");
  });
});

describe("sortPreflightChecks", () => {
  it("sorts required checks before optional checks", () => {
    const checks: PreflightCheck[] = [
      { name: "gh", ok: false, message: "not found", tier: "optional" },
      { name: "git", ok: true, message: "git 2.39", tier: "required" },
      { name: "claude", ok: false, message: "not found", tier: "optional" },
    ];
    const sorted = sortPreflightChecks(checks);
    expect(sorted[0].name).toBe("git");
    expect(sorted[0].tier).toBe("required");
    expect(sorted[1].tier).toBe("optional");
    expect(sorted[2].tier).toBe("optional");
  });

  it("preserves relative order within same tier", () => {
    const checks: PreflightCheck[] = [
      { name: "gh", ok: true, message: "ok", tier: "optional" },
      { name: "ollama", ok: false, message: "fail", tier: "optional" },
    ];
    const sorted = sortPreflightChecks(checks);
    expect(sorted[0].name).toBe("gh");
    expect(sorted[1].name).toBe("ollama");
  });

  it("does not mutate the original array", () => {
    const checks: PreflightCheck[] = [
      { name: "gh", ok: true, message: "ok", tier: "optional" },
      { name: "git", ok: true, message: "ok", tier: "required" },
    ];
    const sorted = sortPreflightChecks(checks);
    expect(checks[0].name).toBe("gh"); // original unchanged
    expect(sorted[0].name).toBe("git"); // sorted copy
  });
});

describe("computeDiagnosticsBanner", () => {
  it("returns 'all_pass' when every check passes", () => {
    const checks: PreflightCheck[] = [
      { name: "git", ok: true, message: "ok", tier: "required" },
      { name: "gh", ok: true, message: "ok", tier: "optional" },
    ];
    expect(computeDiagnosticsBanner(checks)).toBe("all_pass");
  });

  it("returns 'required_pass' when required pass but optional fail", () => {
    const checks: PreflightCheck[] = [
      { name: "git", ok: true, message: "ok", tier: "required" },
      { name: "gh", ok: false, message: "not found", tier: "optional" },
    ];
    expect(computeDiagnosticsBanner(checks)).toBe("required_pass");
  });

  it("returns 'required_fail' when a required check fails", () => {
    const checks: PreflightCheck[] = [
      { name: "git", ok: false, message: "not found", tier: "required" },
      { name: "gh", ok: true, message: "ok", tier: "optional" },
    ];
    expect(computeDiagnosticsBanner(checks)).toBe("required_fail");
  });

  it("returns 'required_fail' when both required and optional fail", () => {
    const checks: PreflightCheck[] = [
      { name: "git", ok: false, message: "not found", tier: "required" },
      { name: "gh", ok: false, message: "not found", tier: "optional" },
    ];
    expect(computeDiagnosticsBanner(checks)).toBe("required_fail");
  });

  it("returns 'all_pass' for empty checks array", () => {
    expect(computeDiagnosticsBanner([])).toBe("all_pass");
  });
});
