import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb } from "./helpers/test-db";
import { seedProject, seedMinimalProject } from "./helpers/fixtures";

const mockConfig = vi.hoisted(() => ({
  sanitizePaths: false,
}));

vi.mock("@/lib/config", () => ({ config: mockConfig }));
vi.mock("@/lib/settings", () => ({
  getSettings: () => ({}),
  clearSettingsCache: () => {},
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
let mergeAllProjects: typeof import("@/lib/merge").mergeAllProjects;
let mergeProjectView: typeof import("@/lib/merge").mergeProjectView;

beforeAll(async () => {
  db = await getTestDb();
  // Re-import merge module so it picks up the test db
  vi.resetModules();
  const mod = await import("@/lib/merge");
  mergeAllProjects = mod.mergeAllProjects;
  mergeProjectView = mod.mergeProjectView;
});

beforeEach(async () => {
  mockConfig.sanitizePaths = false;
  await cleanDb(db);
});

describe("mergeAllProjects — integration", () => {
  it("returns all non-pruned projects", async () => {
    await seedProject(db, { name: "alpha", pathHash: "h-alpha" });
    await seedProject(db, { name: "beta", pathHash: "h-beta" });
    await seedProject(db, { name: "pruned-one", pathHash: "h-pruned", prunedAt: new Date() });

    const result = await mergeAllProjects();
    const names = result.map((p) => p.name);
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
    expect(names).not.toContain("pruned-one");
  });

  it("returns alphabetically sorted by name", async () => {
    await seedProject(db, { name: "zulu", pathHash: "h-z" });
    await seedProject(db, { name: "alpha", pathHash: "h-a" });
    await seedProject(db, { name: "mike", pathHash: "h-m" });

    const result = await mergeAllProjects();
    expect(result.map((p) => p.name)).toEqual(["alpha", "mike", "zulu"]);
  });

  it("excludes pruned project even with full data", async () => {
    await seedProject(db, {
      name: "pruned-full",
      pathHash: "h-pf",
      prunedAt: new Date(),
      override: { statusOverride: "active" },
      metadata: { goal: "Ship it" },
    });

    const result = await mergeAllProjects();
    expect(result).toHaveLength(0);
  });
});

describe("mergeProjectView — integration", () => {
  it("returns null for nonexistent ID", async () => {
    const result = await mergeProjectView("nonexistent-id");
    expect(result).toBeNull();
  });

  it("returns complete MergedProject for fully seeded project", async () => {
    const id = await seedProject(db, {
      name: "full-project",
      pathHash: "h-full",
      override: { statusOverride: "paused", purposeOverride: "Override purpose" },
      metadata: {
        goal: "Ship v1",
        audience: "Devs",
      },
    });

    const result = await mergeProjectView(id);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("full-project");
    expect(result!.id).toBe(id);
    expect(result!.healthScore).toBe(82);
    expect(result!.goal).toBe("Ship v1");
  });

  it("override.statusOverride wins over derived.statusAuto", async () => {
    const id = await seedProject(db, {
      pathHash: "h-status",
      derived: { statusAuto: "active" },
      override: { statusOverride: "paused" },
    });
    const result = await mergeProjectView(id);
    expect(result!.status).toBe("paused");
  });

  it("override.purposeOverride wins over LLM purpose and scan description", async () => {
    const id = await seedProject(db, {
      pathHash: "h-purpose",
      override: { purposeOverride: "My override" },
    });
    const result = await mergeProjectView(id);
    expect(result!.purpose).toBe("My override");
  });

  it("override tags > LLM tags > derived tags", async () => {
    const id = await seedProject(db, {
      pathHash: "h-tags",
      override: { tagsOverride: JSON.stringify(["custom-tag"]) },
    });
    const result = await mergeProjectView(id);
    expect(result!.tags).toEqual(["custom-tag"]);
  });

  it("scores from derived, default to 0 when no derived record", async () => {
    const idWithDerived = await seedProject(db, {
      pathHash: "h-scores",
      derived: { healthScoreAuto: 90, hygieneScoreAuto: 85, momentumScoreAuto: 70 },
    });
    const r1 = await mergeProjectView(idWithDerived);
    expect(r1!.healthScore).toBe(90);
    expect(r1!.hygieneScore).toBe(85);
    expect(r1!.momentumScore).toBe(70);

    const idNoDerived = await seedProject(db, { pathHash: "h-no-derived", derived: false, llm: false });
    const r2 = await mergeProjectView(idNoDerived);
    expect(r2!.healthScore).toBe(0);
    expect(r2!.hygieneScore).toBe(0);
    expect(r2!.momentumScore).toBe(0);
  });

  it("minimal project (scan only) uses graceful defaults", async () => {
    const id = await seedMinimalProject(db, "h-minimal", "bare-project");
    const result = await mergeProjectView(id);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("bare-project");
    expect(result!.status).toBe("archived");
    expect(result!.healthScore).toBe(0);
    expect(result!.tags).toEqual([]);
    expect(result!.purpose).toBeNull();
    expect(result!.goal).toBeNull();
  });
});
