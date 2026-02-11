import { describe, it, expect } from "vitest";
import { validateScanOutput, validateDeriveOutput } from "@/lib/pipeline";

describe("validateScanOutput", () => {
  const validScan = {
    scannedAt: "2025-01-01T00:00:00Z",
    projectCount: 2,
    projects: [
      { name: "proj-a", path: "/dev/proj-a", pathHash: "hash-a" },
      { name: "proj-b", path: "/dev/proj-b", pathHash: "hash-b" },
    ],
  };

  it("passes for valid input", () => {
    const result = validateScanOutput(validScan);
    expect(result.scannedAt).toBe("2025-01-01T00:00:00Z");
    expect(result.projects).toHaveLength(2);
  });

  it("throws for null input", () => {
    expect(() => validateScanOutput(null)).toThrow("not an object");
  });

  it("throws for non-object input", () => {
    expect(() => validateScanOutput("string")).toThrow("not an object");
  });

  it("throws for missing scannedAt", () => {
    const { scannedAt: _, ...noScannedAt } = validScan;
    expect(() => validateScanOutput(noScannedAt)).toThrow("scannedAt");
  });

  it("throws for missing projects array", () => {
    const { projects: _, ...noProjects } = validScan;
    expect(() => validateScanOutput(noProjects)).toThrow("projects");
  });

  it("throws for non-array projects", () => {
    expect(() => validateScanOutput({ ...validScan, projects: "not-array" })).toThrow("projects");
  });

  it("throws for project missing name", () => {
    const bad = {
      ...validScan,
      projects: [{ path: "/dev/x", pathHash: "h" }],
    };
    expect(() => validateScanOutput(bad)).toThrow("projects[0] missing 'name'");
  });

  it("throws for project missing path", () => {
    const bad = {
      ...validScan,
      projects: [{ name: "x", pathHash: "h" }],
    };
    expect(() => validateScanOutput(bad)).toThrow("projects[0] missing 'path'");
  });

  it("throws for project missing pathHash", () => {
    const bad = {
      ...validScan,
      projects: [{ name: "x", path: "/dev/x" }],
    };
    expect(() => validateScanOutput(bad)).toThrow("projects[0] missing 'pathHash'");
  });
});

describe("validateDeriveOutput", () => {
  const validDerive = {
    derivedAt: "2025-01-01T00:00:00Z",
    projects: [
      {
        pathHash: "hash-a",
        statusAuto: "active",
        healthScoreAuto: 75,
        hygieneScoreAuto: 80,
        momentumScoreAuto: 65,
        scoreBreakdownJson: { hygiene: { readme: 15 }, momentum: { recency: 25 } },
        tags: ["typescript"],
      },
    ],
  };

  it("passes for valid input", () => {
    const result = validateDeriveOutput(validDerive);
    expect(result.derivedAt).toBe("2025-01-01T00:00:00Z");
    expect(result.projects).toHaveLength(1);
  });

  it("throws for null input", () => {
    expect(() => validateDeriveOutput(null)).toThrow("not an object");
  });

  it("throws for missing derivedAt", () => {
    const { derivedAt: _, ...noDerivedAt } = validDerive;
    expect(() => validateDeriveOutput(noDerivedAt)).toThrow("derivedAt");
  });

  it("throws for missing projects", () => {
    const { projects: _, ...noProjects } = validDerive;
    expect(() => validateDeriveOutput(noProjects)).toThrow("projects");
  });

  it("throws for project missing pathHash", () => {
    const { pathHash: _, ...noHash } = validDerive.projects[0];
    expect(() =>
      validateDeriveOutput({ ...validDerive, projects: [noHash] }),
    ).toThrow("projects[0] missing 'pathHash'");
  });

  it("throws for project missing statusAuto", () => {
    const { statusAuto: _, ...noStatus } = validDerive.projects[0];
    expect(() =>
      validateDeriveOutput({ ...validDerive, projects: [noStatus] }),
    ).toThrow("projects[0] missing 'statusAuto'");
  });

  it("throws for project missing scores", () => {
    const { healthScoreAuto: _, ...noHealth } = validDerive.projects[0];
    expect(() =>
      validateDeriveOutput({ ...validDerive, projects: [noHealth] }),
    ).toThrow("projects[0] missing 'healthScoreAuto'");
  });

  it("throws for project missing scoreBreakdownJson", () => {
    const { scoreBreakdownJson: _, ...noBreakdown } = validDerive.projects[0];
    expect(() =>
      validateDeriveOutput({ ...validDerive, projects: [noBreakdown] }),
    ).toThrow("projects[0] missing 'scoreBreakdownJson'");
  });

  it("throws for project missing tags", () => {
    const { tags: _, ...noTags } = validDerive.projects[0];
    expect(() =>
      validateDeriveOutput({ ...validDerive, projects: [noTags] }),
    ).toThrow("projects[0] missing 'tags'");
  });
});
