import { describe, it, expect } from "vitest";
import { evaluateAttention } from "@/lib/attention";
import type { Project } from "@/lib/types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-id",
    name: "test-project",
    pathDisplay: "~/dev/test-project",
    status: "active",
    healthScore: 80,
    hygieneScore: 80,
    momentumScore: 80,
    scoreBreakdown: {},
    summary: "Test project",
    tags: [],
    notableFeatures: [],
    recommendations: [],
    notes: null,
    nextAction: null,
    llmStatus: null,
    statusReason: null,
    risks: [],
    isDirty: false,
    ahead: 0,
    behind: 0,
    framework: null,
    branchName: "main",
    lastCommitDate: new Date().toISOString(),
    locEstimate: 1000,
    scan: {
      isRepo: true,
      lastCommitDate: new Date().toISOString(),
      lastCommitMessage: "test commit",
      branch: "main",
      remoteUrl: "https://github.com/test/test",
      commitCount: 100,
      daysInactive: 0,
      isDirty: false,
      languages: { primary: "typescript", detected: ["typescript"] },
      files: {},
      cicd: {},
      deployment: {},
      todoCount: 5,
      fixmeCount: 0,
      description: "A test project",
      recentCommits: [],
      scripts: [],
      services: [],
      packageManager: "npm",
      branchCount: 1,
      stashCount: 0,
      locEstimate: 1000,
      license: true,
      ahead: 0,
      behind: 0,
      framework: null,
      liveUrl: null,
    },
    recentCommits: [],
    scripts: [],
    services: [],
    packageManager: "npm",
    branchCount: 1,
    stashCount: 0,
    license: true,
    pinned: false,
    lastTouchedAt: new Date().toISOString(),
    goal: null,
    audience: null,
    successMetrics: null,
    publishTarget: null,
    lastScanned: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pitch: null,
    liveUrl: null,
    llmGeneratedAt: null,
    ...overrides,
  };
}

describe("evaluateAttention", () => {
  it("flags LOW_HYGIENE as high severity when hygieneScore < 30", () => {
    const p = makeProject({ hygieneScore: 20 });
    const result = evaluateAttention(p);
    expect(result.needsAttention).toBe(true);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "LOW_HYGIENE", severity: "high" }),
    );
  });

  it("flags STALE_MOMENTUM as med severity when momentumScore < 25", () => {
    const p = makeProject({ momentumScore: 20 });
    const result = evaluateAttention(p);
    expect(result.needsAttention).toBe(true);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "STALE_MOMENTUM", severity: "med" }),
    );
  });

  it("flags DIRTY_AGE_GT_7 when isDirty and daysInactive > 7", () => {
    const p = makeProject({
      isDirty: true,
      scan: {
        ...makeProject().scan!,
        daysInactive: 10,
      },
    });
    const result = evaluateAttention(p);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "DIRTY_AGE_GT_7", severity: "med" }),
    );
  });

  it("flags NO_NEXT_ACTION_GT_30 when inactive >30 days with no nextAction", () => {
    const p = makeProject({
      nextAction: null,
      scan: { ...makeProject().scan!, daysInactive: 35 },
    });
    const result = evaluateAttention(p);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "NO_NEXT_ACTION_GT_30", severity: "high" }),
    );
  });

  it("does NOT flag NO_NEXT_ACTION_GT_30 when nextAction is set", () => {
    const p = makeProject({
      nextAction: "Finish docs",
      scan: { ...makeProject().scan!, daysInactive: 35 },
    });
    const result = evaluateAttention(p);
    const codes = result.reasons.map((r) => r.code);
    expect(codes).not.toContain("NO_NEXT_ACTION_GT_30");
  });

  it("flags UNPUSHED_CHANGES when ahead > 0 and daysInactive > 7", () => {
    const p = makeProject({
      ahead: 3,
      scan: { ...makeProject().scan!, daysInactive: 10 },
    });
    const result = evaluateAttention(p);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "UNPUSHED_CHANGES", severity: "low" }),
    );
  });

  it("flags HIGH_TODO_COUNT when todoCount >= 20", () => {
    const p = makeProject({
      scan: { ...makeProject().scan!, todoCount: 25 },
    });
    const result = evaluateAttention(p);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "HIGH_TODO_COUNT", severity: "low" }),
    );
  });

  it("returns needsAttention: false for a healthy project", () => {
    const p = makeProject();
    const result = evaluateAttention(p);
    expect(result.needsAttention).toBe(false);
    expect(result.reasons).toHaveLength(0);
    expect(result.severity).toBe("low");
  });

  it("severity = max of all triggered rules", () => {
    const p = makeProject({
      hygieneScore: 20, // HIGH
      momentumScore: 20, // MED
      scan: { ...makeProject().scan!, todoCount: 25 }, // LOW
    });
    const result = evaluateAttention(p);
    expect(result.severity).toBe("high");
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
