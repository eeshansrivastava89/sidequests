import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildMergedView, type ProjectWithRelations } from "@/lib/merge";

const mockConfig = vi.hoisted(() => ({
  sanitizePaths: false,
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
      dirtyFileCount: 0,
      ahead: 0,
      behind: 0,
      framework: "next",
      branchName: "main",
      lastCommitDate: now,
      locEstimate: 5000,
    },
    llm: {
      summary: "LLM summary",
      nextAction: "Add tests",
      llmStatus: "building",
      statusReason: "Active development",
      risksJson: JSON.stringify(["No tests"]),
      tagsJson: JSON.stringify(["typescript", "next", "fullstack"]),
      recommendationsJson: JSON.stringify(["Add tests"]),
      llmError: null,
      // Legacy
      purpose: "LLM purpose",
      notableFeaturesJson: JSON.stringify(["SSR", "API routes"]),
      pitch: "A great project",
      aiInsightJson: null,
      generatedAt: now,
    },
    override: null,
    metadata: {
      goal: "Ship v1",
      audience: "Developers",
      successMetrics: "100 users",
      nextAction: "Write docs",
      publishTarget: "npm",
    },
    ...overrides,
  } as ProjectWithRelations;
}

beforeEach(() => {
  mockConfig.sanitizePaths = false;
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

  it("override.purposeOverride wins over llm.summary", () => {
    const fixture = makeFixture({
      override: {
        statusOverride: null,
        purposeOverride: "Override summary",
        tagsOverride: null,
        notesOverride: null,
      },
    });
    const merged = buildMergedView(fixture);
    expect(merged.summary).toBe("Override summary");
  });

  it("llm.summary wins over llm.purpose (legacy) when no override", () => {
    const merged = buildMergedView(makeFixture());
    expect(merged.summary).toBe("LLM summary");
  });

  it("llm.purpose (legacy) used as fallback when no summary", () => {
    const fixture = makeFixture({
      llm: {
        ...makeFixture().llm!,
        summary: null,
      },
    });
    const merged = buildMergedView(fixture);
    expect(merged.summary).toBe("LLM purpose");
  });

  it("scan description used when no override and no llm", () => {
    const fixture = makeFixture({ llm: null });
    const merged = buildMergedView(fixture);
    expect(merged.summary).toBe("Scan description");
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

  it("llmError is null when no error", () => {
    const merged = buildMergedView(makeFixture());
    expect(merged.llmError).toBeNull();
  });

  it("llmError is surfaced from Llm record", () => {
    const fixture = makeFixture({
      llm: {
        ...makeFixture().llm!,
        llmError: "Request timed out after 30s",
      },
    });
    const merged = buildMergedView(fixture);
    expect(merged.llmError).toBe("Request timed out after 30s");
  });

  it("llmError is null when no Llm record", () => {
    const fixture = makeFixture({ llm: null });
    const merged = buildMergedView(fixture);
    expect(merged.llmError).toBeNull();
  });

  it("missing layers cascade correctly (no override → falls through)", () => {
    const fixture = makeFixture({
      override: null,
      llm: null,
      metadata: null,
    });
    const merged = buildMergedView(fixture);
    expect(merged.status).toBe("active"); // from derived
    expect(merged.summary).toBe("Scan description"); // from scan
    expect(merged.tags).toEqual(["typescript", "next"]); // from derived
    expect(merged.goal).toBeNull();
    expect(merged.nextAction).toBeNull();
    expect(merged.notes).toBeNull();
  });
});

