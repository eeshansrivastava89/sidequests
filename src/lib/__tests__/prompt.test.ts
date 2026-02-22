import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config before importing prompt module
vi.mock("@/lib/config", () => ({
  config: { sanitizePaths: false },
}));

import { parseEnrichment, buildPrompt } from "@/lib/llm/prompt";
import type { LlmInput } from "@/lib/llm/provider";

describe("parseEnrichment", () => {
  it("valid JSON → correct LlmEnrichment", () => {
    const raw = JSON.stringify({
      summary: "A project dashboard",
      nextAction: "Add tests",
      status: "building",
      statusReason: "Active development",
      tags: ["typescript"],
      insights: ["Set up CI to catch regressions early"],
    });

    const result = parseEnrichment(raw);
    expect(result.summary).toBe("A project dashboard");
    expect(result.nextAction).toBe("Add tests");
    expect(result.status).toBe("building");
    expect(result.statusReason).toBe("Active development");
    expect(result.tags).toEqual(["typescript"]);
    expect(result.insights).toEqual(["Set up CI to catch regressions early"]);
    expect(result.framework).toBeNull();
    expect(result.primaryLanguage).toBeNull();
  });

  it("invalid status → defaults to 'idea'", () => {
    const raw = JSON.stringify({
      summary: "A project",
      status: "unknown-phase",
    });
    const result = parseEnrichment(raw);
    expect(result.status).toBe("idea");
  });

  it("missing nextAction → default fallback", () => {
    const raw = JSON.stringify({
      summary: "A project",
      status: "building",
    });
    const result = parseEnrichment(raw);
    expect(result.nextAction).toBe("Review project and decide next step");
  });

  it("empty nextAction → default fallback", () => {
    const raw = JSON.stringify({
      summary: "A project",
      nextAction: "",
      status: "building",
    });
    const result = parseEnrichment(raw);
    expect(result.nextAction).toBe("Review project and decide next step");
  });

  it("JSON in markdown fences → extracted", () => {
    const raw = '```json\n{"summary":"Fenced","nextAction":"Do thing","status":"shipping","statusReason":"Ready","tags":[],"insights":[]}\n```';
    const result = parseEnrichment(raw);
    expect(result.summary).toBe("Fenced");
    expect(result.status).toBe("shipping");
  });

  it("invalid input → safe defaults", () => {
    const result = parseEnrichment("not json at all");
    expect(result.summary).toBe("");
    expect(result.nextAction).toBe("Review project and decide next step");
    expect(result.status).toBe("idea");
    expect(result.statusReason).toBe("");
    expect(result.tags).toEqual([]);
    expect(result.insights).toEqual([]);
    expect(result.framework).toBeNull();
    expect(result.primaryLanguage).toBeNull();
  });

  it("valid framework and primaryLanguage parsed correctly", () => {
    const raw = JSON.stringify({
      summary: "A Next.js app",
      nextAction: "Deploy",
      status: "shipping",
      statusReason: "Ready",
      tags: ["nextjs"],
      insights: [],
      framework: "Next.js",
      primaryLanguage: "TypeScript",
    });
    const result = parseEnrichment(raw);
    expect(result.framework).toBe("Next.js");
    expect(result.primaryLanguage).toBe("TypeScript");
  });

  it("missing framework/primaryLanguage defaults to null", () => {
    const raw = JSON.stringify({
      summary: "A project",
      status: "building",
    });
    const result = parseEnrichment(raw);
    expect(result.framework).toBeNull();
    expect(result.primaryLanguage).toBeNull();
  });

  it("old-format output (purpose/pitch/aiInsight) → does NOT populate new fields", () => {
    const raw = JSON.stringify({
      purpose: "Old purpose",
      pitch: "Old pitch",
      aiInsight: { score: 80, confidence: "high", reasons: ["Good"], risks: ["Bad"], nextBestAction: "Do X" },
      tags: ["old"],
    });
    const result = parseEnrichment(raw);
    // summary should be empty (purpose is not mapped)
    expect(result.summary).toBe("");
    expect(result.nextAction).toBe("Review project and decide next step");
    expect(result.status).toBe("idea");
    // tags still work since field name is the same
    expect(result.tags).toEqual(["old"]);
  });

  it("filters non-string items from arrays", () => {
    const raw = JSON.stringify({
      summary: "A project",
      status: "building",
      insights: ["Real insight", 42, null, "Another insight"],
      tags: ["valid", true, "also-valid"],
    });
    const result = parseEnrichment(raw);
    expect(result.insights).toEqual(["Real insight", "Another insight"]);
    expect(result.tags).toEqual(["valid", "also-valid"]);
  });

  it("handles object input (not string)", () => {
    const obj = {
      summary: "Object input",
      nextAction: "Test it",
      status: "maintaining",
      statusReason: "Stable",
      tags: ["test"],
      insights: [],
    };
    const result = parseEnrichment(obj);
    expect(result.summary).toBe("Object input");
    expect(result.status).toBe("maintaining");
  });
});

describe("buildPrompt", () => {
  const baseInput: LlmInput = {
    name: "test-project",
    path: "/Users/dev/test-project",
    scan: { isRepo: true, branch: "main" },
    derived: {
      statusAuto: "active",
      healthScoreAuto: 80,
      hygieneScoreAuto: 70,
      momentumScoreAuto: 60,
      tags: ["typescript"],
    },
  };

  it("includes GitHub section when github data present", () => {
    const input: LlmInput = {
      ...baseInput,
      github: {
        openIssues: 5,
        openPrs: 2,
        ciStatus: "success",
        repoVisibility: "public",
      },
    };
    const prompt = buildPrompt(input);
    expect(prompt).toContain("GitHub data:");
    expect(prompt).toContain("Open Issues: 5");
    expect(prompt).toContain("Open PRs: 2");
    expect(prompt).toContain("CI Status: success");
  });

  it("omits GitHub section when absent", () => {
    const prompt = buildPrompt(baseInput);
    expect(prompt).not.toContain("GitHub data:");
  });

  it("includes previous summary when present", () => {
    const input: LlmInput = {
      ...baseInput,
      previousSummary: "Was a cool project last time",
    };
    const prompt = buildPrompt(input);
    expect(prompt).toContain("Previous summary (for continuity):");
    expect(prompt).toContain("Was a cool project last time");
  });

  it("omits previous summary when absent", () => {
    const prompt = buildPrompt(baseInput);
    expect(prompt).not.toContain("Previous summary");
  });

  it("includes hygiene and momentum scores", () => {
    const prompt = buildPrompt(baseInput);
    expect(prompt).toContain("Hygiene Score: 70/100");
    expect(prompt).toContain("Momentum Score: 60/100");
  });

  it("includes GitHub top issues/PRs when present", () => {
    const input: LlmInput = {
      ...baseInput,
      github: {
        openIssues: 3,
        openPrs: 1,
        ciStatus: "failure",
        repoVisibility: "private",
        topIssues: '[{"title":"Bug"}]',
        topPrs: '[{"title":"Feature"}]',
      },
    };
    const prompt = buildPrompt(input);
    expect(prompt).toContain("Top Issues:");
    expect(prompt).toContain("Top PRs:");
  });
});
