/**
 * Express API integration tests.
 *
 * These tests verify that the Express route handlers behave correctly.
 * Uses supertest to test routes without starting an HTTP server.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getTestDb, cleanDb, TEST_DB_PATH } from "@/lib/__tests__/helpers/test-db";
import { seedProject } from "@/lib/__tests__/helpers/fixtures";
import { createTestApp } from "./helpers/create-app";

// Mock config and settings before importing the app
const mockConfig = vi.hoisted(() => ({
  sanitizePaths: false,
}));

vi.mock("@/lib/config", () => ({ config: mockConfig }));
vi.mock("@/lib/settings", () => ({
  getSettings: () => ({}),
  clearSettingsCache: () => {},
}));
vi.mock("@/lib/llm", () => ({
  getLlmProvider: () => null,
}));
vi.mock("@/lib/pipeline", () => ({
  runRefreshPipeline: vi.fn().mockResolvedValue({ projectCount: 0 }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  // Ensure DB schema is current by running bootstrap migrations
  // @ts-expect-error -- .mjs import has no type declarations
  const { bootstrapDb } = await import("../../../../bin/bootstrap-db.mjs");
  await bootstrapDb(TEST_DB_PATH);

  db = await getTestDb();
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDb(db);
});

// ── Projects list ─────────────────────────────────────────

describe("Express GET /api/projects", () => {
  it("returns empty list when no projects exist", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.projects).toEqual([]);
  });

  it("returns projects with merged data", async () => {
    await seedProject(db, { pathHash: "h-express-1" });
    const res = await request(app).get("/api/projects");
    expect(res.body.ok).toBe(true);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe("test-project");
  });
});

// ── Project detail ───────────────────────────────────────

describe("Express GET /api/projects/:id", () => {
  it("returns 404 for nonexistent project", async () => {
    const res = await request(app).get("/api/projects/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it("returns project with merged data", async () => {
    const id = await seedProject(db, { pathHash: "h-express-2" });
    const res = await request(app).get(`/api/projects/${id}`);
    expect(res.body.ok).toBe(true);
    expect(res.body.project.id).toBe(id);
  });
});

// ── Override ───────────────────────────────────────────────

describe("Express PATCH /api/projects/:id/override", () => {
  it("upserts valid string fields and logs activity", async () => {
    const id = await seedProject(db, { pathHash: "h-express-ov1" });

    const res = await request(app)
      .patch(`/api/projects/${id}/override`)
      .send({ statusOverride: "paused" });

    expect(res.body.ok).toBe(true);
    expect(res.body.override.statusOverride).toBe("paused");

    const activity = await db.activity.findFirst({ where: { projectId: id, type: "override" } });
    expect(activity).not.toBeNull();
  });

  it("JSON coercion — tagsOverride as array is stored as JSON string", async () => {
    const id = await seedProject(db, { pathHash: "h-express-ov2" });

    const res = await request(app)
      .patch(`/api/projects/${id}/override`)
      .send({ tagsOverride: ["a", "b"] });

    expect(res.body.ok).toBe(true);
    expect(res.body.override.tagsOverride).toBe(JSON.stringify(["a", "b"]));
  });

  it("400 on empty body", async () => {
    const id = await seedProject(db, { pathHash: "h-express-ov3" });

    const res = await request(app)
      .patch(`/api/projects/${id}/override`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("404 for nonexistent project", async () => {
    const res = await request(app)
      .patch("/api/projects/nonexistent/override")
      .send({ statusOverride: "active" });

    expect(res.status).toBe(404);
  });
});

// ── Pin ───────────────────────────────────────────────────

describe("Express PATCH /api/projects/:id/pin", () => {
  it("toggles pin state", async () => {
    const id = await seedProject(db, { pathHash: "h-express-pin" });

    const res1 = await request(app).patch(`/api/projects/${id}/pin`);
    expect(res1.body.ok).toBe(true);
    expect(res1.body.pinned).toBe(true);

    const res2 = await request(app).patch(`/api/projects/${id}/pin`);
    expect(res2.body.pinned).toBe(false);
  });

  it("404 for missing project", async () => {
    const res = await request(app).patch("/api/projects/nonexistent/pin");
    expect(res.status).toBe(404);
  });
});

// ── Touch ─────────────────────────────────────────────────

describe("Express POST /api/projects/:id/touch", () => {
  it("updates lastTouchedAt and logs activity", async () => {
    const id = await seedProject(db, { pathHash: "h-express-touch" });
    const before = await db.project.findUnique({ where: { id } });

    const res = await request(app)
      .post(`/api/projects/${id}/touch`)
      .send({ tool: "vscode" });

    expect(res.body.ok).toBe(true);

    const after = await db.project.findUnique({ where: { id } });
    expect(new Date(after.lastTouchedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before.lastTouchedAt).getTime(),
    );

    const activity = await db.activity.findFirst({ where: { projectId: id, type: "opened" } });
    expect(activity).not.toBeNull();
    expect(JSON.parse(activity.payloadJson).tool).toBe("vscode");
  });
});

// ── Metadata ──────────────────────────────────────────────

describe("Express PATCH /api/projects/:id/metadata", () => {
  it("upserts valid fields and logs activity", async () => {
    const id = await seedProject(db, { pathHash: "h-express-md1" });

    const res = await request(app)
      .patch(`/api/projects/${id}/metadata`)
      .send({ goal: "Ship v1" });

    expect(res.body.ok).toBe(true);
    expect(res.body.metadata.goal).toBe("Ship v1");

    const activity = await db.activity.findFirst({ where: { projectId: id, type: "metadata" } });
    expect(activity).not.toBeNull();
  });

  it("400 on empty body", async () => {
    const id = await seedProject(db, { pathHash: "h-express-md2" });
    const res = await request(app)
      .patch(`/api/projects/${id}/metadata`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── Activity ──────────────────────────────────────────────

describe("Express GET /api/projects/:id/activity", () => {
  it("returns activity for a project", async () => {
    const id = await seedProject(db, { pathHash: "h-express-act" });
    // Seed some activity
    await db.activity.create({
      data: { projectId: id, type: "scan", payloadJson: JSON.stringify({ scannedAt: new Date().toISOString() }) },
    });

    const res = await request(app).get(`/api/projects/${id}/activity`);
    expect(res.body.ok).toBe(true);
    expect(res.body.activities).toHaveLength(1);
    expect(res.body.activities[0].type).toBe("scan");
  });

  it("404 for missing project", async () => {
    const res = await request(app).get("/api/projects/nonexistent/activity");
    expect(res.status).toBe(404);
  });
});

// ── Simple routes ─────────────────────────────────────────

describe("Express simple routes", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.ts).toBeDefined();
  });

  it("GET /api/preflight returns checks array", async () => {
    const res = await request(app).get("/api/preflight");
    expect(res.status).toBe(200);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.length).toBeGreaterThan(0);
  });

  it("GET /api/version returns version info", async () => {
    const res = await request(app).get("/api/version");
    expect(res.status).toBe(200);
    expect(res.body.current).toBeDefined();
    expect(typeof res.body.updateAvailable).toBe("boolean");
  });
});