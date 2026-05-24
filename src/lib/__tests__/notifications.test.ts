import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateNotificationRules,
  isInQuietHours,
  type NotificationRule,
} from "../notifications";
import type { MergedProject } from "../merge";

// ── Helpers ─────────────────────────────────────────────

function makeProject(overrides: Partial<MergedProject> = {}): MergedProject {
  return {
    id: "proj-1",
    name: "test-project",
    pathHash: "hash1",
    pathDisplay: "/dev/test-project",
    status: "active",
    healthScore: 80,
    hygieneScore: 80,
    momentumScore: 80,
    scoreBreakdown: {},
    summary: null,
    tags: [],
    insights: [],
    notes: null,
    nextAction: null,
    llmStatus: null,
    statusReason: null,
    isDirty: false,
    dirtyFileCount: 0,
    ahead: 0,
    behind: 0,
    framework: null,
    primaryLanguage: null,
    branchName: "main",
    lastCommitDate: new Date().toISOString(),
    locEstimate: 1000,
    locCode: 800,
    locDocs: 100,
    locGenerated: 100,
    scan: null,
    recentCommits: [],
    scripts: [],
    services: [],
    packageManager: null,
    branchCount: 1,
    stashCount: 0,
    license: true,
    pinned: false,
    lastTouchedAt: null,
    snoozedUntil: null,
    archivedNote: null,
    goal: null,
    audience: null,
    successMetrics: null,
    publishTarget: null,
    lastScanned: null,
    updatedAt: "2026-01-01",
    llmError: null,
    liveUrl: null,
    llmGeneratedAt: null,
    openIssues: 0,
    openPrs: 0,
    ciStatus: "none",
    issuesTopJson: null,
    prsTopJson: null,
    repoVisibility: "public",
    githubFetchedAt: null,
    weekCommits: 0,
    monthCommits: 0,
    quarterCommits: 0,
    ...overrides,
  };
}

// Mock the db module so evaluateNotificationRules can query GitHub state
vi.mock("../db", () => ({
  db: {
    gitHub: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    activity: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    userPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { db } from "../db";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── CI Failure Rules ─────────────────────────────────────

describe("evaluateNotificationRules — CI failure", () => {
  it("fires when CI transitions from passing to failing", async () => {
    const project = makeProject({ ciStatus: "failure" });
    (db.gitHub.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { projectId: "proj-1", ciStatus: "success" },
    ]);

    const rules = await evaluateNotificationRules([project]);
    const ciRules = rules.filter((r) => r.type === "ci-failure");
    expect(ciRules).toHaveLength(1);
    expect(ciRules[0].projectName).toBe("test-project");
    expect(ciRules[0].title).toBe("CI Failing");
  });

  it("does not fire when CI was already failing", async () => {
    const project = makeProject({ ciStatus: "failure" });
    (db.gitHub.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { projectId: "proj-1", ciStatus: "failure" },
    ]);

    const rules = await evaluateNotificationRules([project]);
    const ciRules = rules.filter((r) => r.type === "ci-failure");
    expect(ciRules).toHaveLength(0);
  });

  it("does not fire when CI is passing", async () => {
    const project = makeProject({ ciStatus: "success" });
    (db.gitHub.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const rules = await evaluateNotificationRules([project]);
    const ciRules = rules.filter((r) => r.type === "ci-failure");
    expect(ciRules).toHaveLength(0);
  });
});

// ── Stale Threshold Rules ────────────────────────────────

describe("evaluateNotificationRules — stale threshold", () => {
  it("fires at 30-day threshold", async () => {
    const project = makeProject({
      lastCommitDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const rules = await evaluateNotificationRules([project]);
    const staleRules = rules.filter((r) => r.type === "stale-threshold");
    expect(staleRules).toHaveLength(1);
    expect(staleRules[0].title).toBe("30d Inactive");
  });

  it("fires at 60-day threshold", async () => {
    const project = makeProject({
      lastCommitDate: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Previous state: was at 58 days (below 60)
    const prevProject = makeProject({
      lastCommitDate: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const rules = await evaluateNotificationRules([project], [prevProject]);
    const staleRules = rules.filter((r) => r.type === "stale-threshold");
    expect(staleRules).toHaveLength(1);
    expect(staleRules[0].title).toBe("60d Inactive");
  });

  it("does not fire for active projects", async () => {
    const project = makeProject({
      lastCommitDate: new Date().toISOString(),
    });

    const rules = await evaluateNotificationRules([project]);
    const staleRules = rules.filter((r) => r.type === "stale-threshold");
    expect(staleRules).toHaveLength(0);
  });

  it("does not fire for archived projects", async () => {
    const project = makeProject({
      status: "archived",
      lastCommitDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const rules = await evaluateNotificationRules([project]);
    const staleRules = rules.filter((r) => r.type === "stale-threshold");
    expect(staleRules).toHaveLength(0);
  });
});

// ── Unpushed Commits Rules ───────────────────────────────

describe("evaluateNotificationRules — unpushed aging", () => {
  it("fires when project has unpushed commits and is >7 days inactive", async () => {
    const project = makeProject({
      ahead: 3,
      lastCommitDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const rules = await evaluateNotificationRules([project]);
    const unpushedRules = rules.filter((r) => r.type === "unpushed-aging");
    expect(unpushedRules).toHaveLength(1);
    expect(unpushedRules[0].message).toContain("3 unpushed");
  });

  it("does not fire when project is recently active", async () => {
    const project = makeProject({
      ahead: 3,
      lastCommitDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const rules = await evaluateNotificationRules([project]);
    const unpushedRules = rules.filter((r) => r.type === "unpushed-aging");
    expect(unpushedRules).toHaveLength(0);
  });

  it("does not fire when there are no unpushed commits", async () => {
    const project = makeProject({
      ahead: 0,
      lastCommitDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const rules = await evaluateNotificationRules([project]);
    const unpushedRules = rules.filter((r) => r.type === "unpushed-aging");
    expect(unpushedRules).toHaveLength(0);
  });
});

// ── Quiet Hours ──────────────────────────────────────────

describe("isInQuietHours", () => {
  it("returns false when quiet hours are null", () => {
    expect(isInQuietHours(null)).toBe(false);
  });

  it("returns false when quiet hours are disabled", () => {
    expect(isInQuietHours({ enabled: false, start: "22:00", end: "08:00" })).toBe(false);
  });

  it("returns true during same-day quiet hours", () => {
    // Simulate 23:00 with quiet hours 22:00–08:00
    const now = new Date();
    now.setHours(23, 0, 0, 0);
    expect(isInQuietHours({ enabled: true, start: "22:00", end: "08:00" }, now)).toBe(true);
  });

  it("returns false outside same-day quiet hours", () => {
    // Simulate 10:00 with quiet hours 22:00–08:00
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    expect(isInQuietHours({ enabled: true, start: "22:00", end: "08:00" }, now)).toBe(false);
  });

  it("returns true during early morning quiet hours (overnight range)", () => {
    // Simulate 03:00 with quiet hours 22:00–08:00
    const now = new Date();
    now.setHours(3, 0, 0, 0);
    expect(isInQuietHours({ enabled: true, start: "22:00", end: "08:00" }, now)).toBe(true);
  });
});