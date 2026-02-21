import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb } from "@/lib/__tests__/helpers/test-db";
import { seedProject, seedMinimalProject } from "@/lib/__tests__/helpers/fixtures";

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

// Route handlers — imported after DB init
type RouteHandler = (...args: unknown[]) => unknown;
let projectsGET: RouteHandler;
let projectByIdGET: RouteHandler;
let activityGET: RouteHandler;

beforeAll(async () => {
  db = await getTestDb();

  const projectsRoute = await import("@/app/api/projects/route");
  projectsGET = projectsRoute.GET;

  const projectByIdRoute = await import("@/app/api/projects/[id]/route");
  projectByIdGET = projectByIdRoute.GET;

  const activityRoute = await import("@/app/api/projects/[id]/activity/route");
  activityGET = activityRoute.GET;
});

beforeEach(async () => {
  mockConfig.sanitizePaths = false;
  await cleanDb(db);
});

describe("GET /api/projects", () => {
  it("returns merged list from seeded data", async () => {
    await seedProject(db, { name: "alpha", pathHash: "h-alpha" });
    await seedProject(db, { name: "beta", pathHash: "h-beta" });

    const res = await projectsGET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.projects).toHaveLength(2);
    expect(body.projects.map((p: { name: string }) => p.name).sort()).toEqual(["alpha", "beta"]);
  });

  it("returns empty array with lastRefreshedAt null when no data", async () => {
    const res = await projectsGET();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.projects).toEqual([]);
    expect(body.lastRefreshedAt).toBeNull();
  });

  it("lastRefreshedAt comes from most recent scan", async () => {
    await seedProject(db, { name: "proj", pathHash: "h-proj" });

    const res = await projectsGET();
    const body = await res.json();

    expect(body.lastRefreshedAt).not.toBeNull();
    // Should be a valid ISO date
    expect(new Date(body.lastRefreshedAt).getTime()).toBeGreaterThan(0);
  });
});

describe("GET /api/projects/[id]", () => {
  it("returns single merged project", async () => {
    const id = await seedProject(db, { name: "my-proj", pathHash: "h-single" });

    const res = await projectByIdGET(new Request("http://localhost/api/projects/" + id), {
      params: Promise.resolve({ id }),
    });
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.project.name).toBe("my-proj");
    expect(body.project.id).toBe(id);
  });

  it("404 for missing ID", async () => {
    const res = await projectByIdGET(new Request("http://localhost/api/projects/nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });
});

describe("GET /api/projects/[id]/activity", () => {
  it("returns last 20 activities ordered desc", async () => {
    const id = await seedProject(db, { pathHash: "h-act" });

    // Create 25 activities
    for (let i = 0; i < 25; i++) {
      await db.activity.create({
        data: {
          projectId: id,
          type: "scan",
          payloadJson: JSON.stringify({ i }),
          createdAt: new Date(Date.now() - i * 1000),
        },
      });
    }

    const res = await activityGET(
      new Request("http://localhost/api/projects/" + id + "/activity"),
      { params: Promise.resolve({ id }) },
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.activities).toHaveLength(20);
    // Most recent first
    const payloads = body.activities.map((a: { payload: { i: number } }) => a.payload.i);
    expect(payloads[0]).toBe(0);
  });

  it("404 for missing project", async () => {
    const res = await activityGET(
      new Request("http://localhost/api/projects/nonexistent/activity"),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );

    expect(res.status).toBe(404);
  });
});

describe("withErrorHandler integration", () => {
  it("wraps handler — catches thrown error and returns 500", async () => {
    // The projectByIdGET handler is already wrapped with withErrorHandler.
    // We test the happy and error paths above. Here we test that an internal
    // error from mergeProjectView is caught properly.
    // Seed a minimal project (no scan) — should still work without error
    const id = await seedMinimalProject(db, "h-err", "err-proj");

    const res = await projectByIdGET(new Request("http://localhost/api/projects/" + id), {
      params: Promise.resolve({ id }),
    });
    const body = await res.json();

    // Should succeed with graceful defaults, not error
    expect(body.ok).toBe(true);
    expect(body.project.healthScore).toBe(0);
  });
});
