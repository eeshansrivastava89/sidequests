import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildMergedView, type ProjectWithRelations } from "@/lib/merge";

const mockConfig = vi.hoisted(() => ({
  sanitizePaths: false,
  featureO1: false,
}));

vi.mock("@/lib/config", () => ({
  config: mockConfig,
}));

vi.mock("@/lib/db", () => ({ db: {} }));

function makeFixture(overrides: Partial<ProjectWithRelations> = {}): ProjectWithRelations {
  const now = new Date();
  return {
    id: "proj-1",
    name: "test-project",
    pathHash: "abc123",
    pathDisplay: "/Users/test/dev/test-project",
    pinned: false,
    lastTouchedAt: now,
    prunedAt: null,
    createdAt: now,
    updatedAt: now,
    scan: {
      rawJson: JSON.stringify({
        isRepo: true,
        lastCommitDate: now.toISOString(),
        lastCommitMessage: "init",
        branch: "main",
        remoteUrl: "https://github.com/test/test",
        commitCount: 50,
        daysInactive: 2,
        isDirty: false,
        languages: { primary: "typescript", detected: ["typescript"] },
        files: {},
        cicd: {},
        deployment: {},
        todoCount: 3,
        fixmeCount: 0,
        description: "Scan description",
        recentCommits: [{ hash: "abc", message: "init", date: now.toISOString() }],
        scripts: ["build", "test"],
        services: ["postgres"],
        packageManager: "npm",
        branchCount: 2,
        stashCount: 0,
        locEstimate: 5000,
        license: true,
        ahead: 0,
        behind: 0,
        framework: "next",
        liveUrl: null,
      }),
      scannedAt: now,
    },
    derived: {
      statusAuto: "active",
      healthScoreAuto: 75,
      hygieneScoreAuto: 80,
      momentumScoreAuto: 65,
      scoreBreakdownJson: JSON.stringify({ hygiene: { readme: 15 }, momentum: { recency: 25 } }),
      derivedJson: JSON.stringify({ tags: ["typescript", "next"] }),
      isDirty: false,
      ahead: 0,
      behind: 0,
      framework: "next",
      branchName: "main",
      lastCommitDate: now,
      locEstimate: 5000,
    },
    llm: {
      purpose: "LLM purpose",
      tagsJson: JSON.stringify(["typescript", "next", "fullstack"]),
      notableFeaturesJson: JSON.stringify(["SSR", "API routes"]),
      recommendationsJson: JSON.stringify(["Add tests"]),
      pitch: "A great project",
      aiInsightJson: JSON.stringify({
        score: 80,
        confidence: "high",
        reasons: ["Good structure"],
        risks: ["No tests"],
        nextBestAction: "Add tests",
      }),
      generatedAt: now,
    },
    override: null,
    metadata: {
      goal: "Ship v1",
      audience: "Developers",
      successMetrics: "100 users",
      nextAction: "Write docs",
      publishTarget: "npm",
      evidenceJson: JSON.stringify({ commits: 50 }),
      outcomesJson: JSON.stringify({ users: 10 }),
    },
    ...overrides,
  } as ProjectWithRelations;
}

beforeEach(() => {
  mockConfig.sanitizePaths = false;
  mockConfig.featureO1 = false;
});

describe("buildMergedView — priority logic", () => {
  it("override.statusOverride wins over derived.statusAuto", () => {
    const fixture = makeFixture({
      override: {
        statusOverride: "paused",
        purposeOverride: null,
        tagsOverride: null,
        notesOverride: null,
      },
    });
    const merged = buildMergedView(fixture);
    expect(merged.status).toBe("paused");
  });

  it("derived.statusAuto is used when no override", () => {
    const merged = buildMergedView(makeFixture());
    expect(merged.status).toBe("active");
  });

  it("defaults to 'archived' when no override and no derived", () => {
    const fixture = makeFixture({ derived: null });
    const merged = buildMergedView(fixture);
    expect(merged.status).toBe("archived");
  });

  it("override.purposeOverride wins over llm.purpose", () => {
    const fixture = makeFixture({
      override: {
        statusOverride: null,
        purposeOverride: "Override purpose",
        tagsOverride: null,
        notesOverride: null,
      },
    });
    const merged = buildMergedView(fixture);
    expect(merged.purpose).toBe("Override purpose");
  });

  it("llm.purpose wins over scan description when no override", () => {
    const merged = buildMergedView(makeFixture());
    expect(merged.purpose).toBe("LLM purpose");
  });

  it("scan description used when no override and no llm", () => {
    const fixture = makeFixture({ llm: null });
    const merged = buildMergedView(fixture);
    expect(merged.purpose).toBe("Scan description");
  });

  it("override tags win over llm tags", () => {
    const fixture = makeFixture({
      override: {
        statusOverride: null,
        purposeOverride: null,
        tagsOverride: JSON.stringify(["custom-tag"]),
        notesOverride: null,
      },
    });
    const merged = buildMergedView(fixture);
    expect(merged.tags).toEqual(["custom-tag"]);
  });

  it("llm tags used when no override tags", () => {
    const merged = buildMergedView(makeFixture());
    expect(merged.tags).toEqual(["typescript", "next", "fullstack"]);
  });

  it("derived tags used when no override and no llm tags", () => {
    const fixture = makeFixture({
      llm: {
        ...makeFixture().llm!,
        tagsJson: null,
      },
    });
    const merged = buildMergedView(fixture);
    expect(merged.tags).toEqual(["typescript", "next"]);
  });

  it("scores come from derived, default to 0 when missing", () => {
    const merged = buildMergedView(makeFixture());
    expect(merged.healthScore).toBe(75);
    expect(merged.hygieneScore).toBe(80);
    expect(merged.momentumScore).toBe(65);

    const noDerived = buildMergedView(makeFixture({ derived: null }));
    expect(noDerived.healthScore).toBe(0);
    expect(noDerived.hygieneScore).toBe(0);
    expect(noDerived.momentumScore).toBe(0);
  });

  it("metadata fields are passed through", () => {
    const merged = buildMergedView(makeFixture());
    expect(merged.goal).toBe("Ship v1");
    expect(merged.nextAction).toBe("Write docs");
  });

  it("missing layers cascade correctly (no override → falls through)", () => {
    const fixture = makeFixture({
      override: null,
      llm: null,
      metadata: null,
    });
    const merged = buildMergedView(fixture);
    expect(merged.status).toBe("active"); // from derived
    expect(merged.purpose).toBe("Scan description"); // from scan
    expect(merged.tags).toEqual(["typescript", "next"]); // from derived
    expect(merged.goal).toBeNull();
    expect(merged.nextAction).toBeNull();
    expect(merged.notes).toBeNull();
  });
});

describe("buildMergedView — featureO1 gate", () => {
  it("evidence and outcomes are null when featureO1 is false", () => {
    mockConfig.featureO1 = false;
    const merged = buildMergedView(makeFixture());
    expect(merged.evidence).toBeNull();
    expect(merged.outcomes).toBeNull();
  });

  it("evidence and outcomes are populated when featureO1 is true", () => {
    mockConfig.featureO1 = true;
    const merged = buildMergedView(makeFixture());
    expect(merged.evidence).toEqual({ commits: 50 });
    expect(merged.outcomes).toEqual({ users: 10 });
  });
});
