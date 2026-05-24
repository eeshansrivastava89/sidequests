import { describe, it, expect } from "vitest";
import { computeActions, filterActions, isSnoozed, type PriorityAction } from "../actions";
import type { MergedProject } from "../merge";

/** Create a minimal MergedProject for testing. */
function makeProject(overrides: Partial<MergedProject> = {}): MergedProject {
  return {
    id: "p1",
    name: "test-project",
    pathHash: "h1",
    pathDisplay: "~/dev/test-project",
    status: "active",
    healthScore: 70,
    hygieneScore: 80,
    momentumScore: 60,
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
    recentCommits: [],
    scripts: [],
    services: [],
    packageManager: null,
    branchCount: 1,
    stashCount: 0,
    license: false,
    weekCommits: 5,
    monthCommits: 20,
    quarterCommits: 50,
    pinned: false,
    lastTouchedAt: null,
    snoozedUntil: null,
    archivedNote: null,
    goal: null,
    audience: null,
    successMetrics: null,
    publishTarget: null,
    llmError: null,
    liveUrl: null,
    llmGeneratedAt: null,
    openIssues: 0,
    openPrs: 0,
    ciStatus: "none",
    issuesTopJson: null,
    prsTopJson: null,
    repoVisibility: "not-on-github",
    githubFetchedAt: null,
    lastScanned: null,
    updatedAt: new Date().toISOString(),
    scan: null,
    ...overrides,
  };
}

describe("computeActions", () => {
  it("returns empty array for a healthy project with no issues", () => {
    const project = makeProject();
    const actions = computeActions(project);
    expect(actions).toEqual([]);
  });

  it("flags git-urgent for dirty tree + inactive >7 days", () => {
    const project = makeProject({
      isDirty: true,
      dirtyFileCount: 3,
      lastCommitDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const actions = computeActions(project);
    expect(actions.some((a) => a.type === "git-urgent")).toBe(true);
  });

  it("flags git-urgent for unpushed commits + inactive >7 days", () => {
    const project = makeProject({
      ahead: 5,
      lastCommitDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const actions = computeActions(project);
    expect(actions.some((a) => a.type === "git-urgent")).toBe(true);
  });

  it("flags git-warning for dirty tree with recent activity", () => {
    const project = makeProject({
      isDirty: true,
      dirtyFileCount: 2,
      lastCommitDate: new Date().toISOString(),
    });
    const actions = computeActions(project);
    expect(actions.some((a) => a.type === "git-warning")).toBe(true);
  });

  it("flags issue for open GitHub issues", () => {
    const project = makeProject({ openIssues: 3, repoVisibility: "public" });
    const actions = computeActions(project);
    expect(actions.some((a) => a.type === "issue")).toBe(true);
  });

  it("flags issue for CI failure", () => {
    const project = makeProject({ ciStatus: "failure" });
    const actions = computeActions(project);
    expect(actions.some((a) => a.type === "issue" && a.label.includes("CI"))).toBe(true);
  });

  it("flags llm-suggestion when nextAction is set", () => {
    const project = makeProject({ nextAction: "Fix the auth bug" });
    const actions = computeActions(project);
    expect(actions.some((a) => a.type === "llm-suggestion")).toBe(true);
  });

  it("does not flag llm-suggestion for archived projects", () => {
    const project = makeProject({ nextAction: "Fix the auth bug", status: "archived" });
    const actions = computeActions(project);
    expect(actions.some((a) => a.type === "llm-suggestion")).toBe(false);
  });

  it("flags stale-decision for stale projects", () => {
    const project = makeProject({
      status: "stale",
      lastCommitDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const actions = computeActions(project);
    expect(actions.some((a) => a.type === "stale-decision")).toBe(true);
  });

  it("sorts actions by severity (high first)", () => {
    const project = makeProject({
      isDirty: true,
      dirtyFileCount: 5,
      openIssues: 2,
      ciStatus: "failure",
      lastCommitDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const actions = computeActions(project);
    const severities = actions.map((a) => a.severity);
    // All high-severity actions should come before low-severity
    const lastHigh = severities.lastIndexOf("high");
    const firstLow = severities.indexOf("low");
    if (lastHigh !== -1 && firstLow !== -1) {
      expect(lastHigh).toBeLessThan(firstLow);
    }
  });
});

describe("filterActions", () => {
  it("filters out dismissed alerts", () => {
    const actions: PriorityAction[] = [
      { type: "git-urgent", label: "test", source: "git", severity: "high", projectId: "p1", projectName: "proj" },
      { type: "issue", label: "test2", source: "issue", severity: "med", projectId: "p1", projectName: "proj" },
    ];

    const dismissed = [{ projectId: "p1", alertType: "git-urgent" }];
    const result = filterActions(actions, dismissed);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("issue");
  });

  it("returns all actions when nothing is dismissed", () => {
    const actions: PriorityAction[] = [
      { type: "git-urgent", label: "test", source: "git", severity: "high", projectId: "p1", projectName: "proj" },
    ];

    const result = filterActions(actions, []);
    expect(result).toHaveLength(1);
  });
});

describe("isSnoozed", () => {
  it("returns false when snoozedUntil is null", () => {
    const project = makeProject({ snoozedUntil: null });
    expect(isSnoozed(project)).toBe(false);
  });

  it("returns true when snoozedUntil is in the future", () => {
    const project = makeProject({
      snoozedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isSnoozed(project)).toBe(true);
  });

  it("returns false when snoozedUntil is in the past", () => {
    const project = makeProject({
      snoozedUntil: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isSnoozed(project)).toBe(false);
  });
});