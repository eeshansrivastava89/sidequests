/**
 * Integration tests for Phase 2 routes: dismiss-alert, focus, visit, shipped.
 * Uses supertest with Express app.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { getTestDb, cleanDb, TEST_DB_PATH } from "@/lib/__tests__/helpers/test-db";
import { seedProject } from "@/lib/__tests__/helpers/fixtures";
import { createTestApp } from "./helpers/create-app";

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
  const { bootstrapDb } = await import("../../../../bin/bootstrap-db.mjs");
  await bootstrapDb(TEST_DB_PATH);
  db = await getTestDb();
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDb(db);
});

// ── Dismiss Alert ──────────────────────────────────────────

describe("POST /api/projects/:id/dismiss-alert", () => {
  it("creates a dismissed alert", async () => {
    const id = await seedProject(db, { pathHash: "dismiss-1" });
    const res = await request(app)
      .post(`/api/projects/${id}/dismiss-alert`)
      .send({ alertType: "git-urgent" });
    expect(res.body.ok).toBe(true);
    expect(res.body.dismissed.alertType).toBe("git-urgent");
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await request(app)
      .post("/api/projects/nonexistent/dismiss-alert")
      .send({ alertType: "git-urgent" });
    expect(res.status).toBe(404);
  });

  it("returns 400 if alertType is missing", async () => {
    const id = await seedProject(db, { pathHash: "dismiss-2" });
    const res = await request(app)
      .post(`/api/projects/${id}/dismiss-alert`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/projects/:id/dismiss-alert", () => {
  it("deletes a dismissed alert", async () => {
    const id = await seedProject(db, { pathHash: "dismiss-3" });
    // Create it first
    await request(app)
      .post(`/api/projects/${id}/dismiss-alert`)
      .send({ alertType: "git-warning" });
    // Then delete it
    const res = await request(app)
      .delete(`/api/projects/${id}/dismiss-alert?alertType=git-warning`);
    expect(res.body.ok).toBe(true);
  });

  it("returns 400 if alertType query param is missing", async () => {
    const res = await request(app)
      .delete("/api/projects/any/dismiss-alert");
    expect(res.status).toBe(400);
  });
});

// ── Focus ──────────────────────────────────────────────────

describe("GET /api/focus", () => {
  it("returns empty focus list", async () => {
    const res = await request(app).get("/api/focus");
    expect(res.body.ok).toBe(true);
    expect(res.body.goals).toEqual([]);
    expect(res.body.weekStart).toBeDefined();
  });
});

describe("POST /api/focus", () => {
  it("creates a weekly focus goal", async () => {
    const id = await seedProject(db, { pathHash: "focus-1" });
    const res = await request(app)
      .post("/api/focus")
      .send({ projectId: id, goal: "Ship auth feature" });
    expect(res.body.ok).toBe(true);
    expect(res.body.focus.goal).toBe("Ship auth feature");
    expect(res.body.focus.completed).toBe(false);
  });

  it("returns 400 if goal is missing", async () => {
    const id = await seedProject(db, { pathHash: "focus-2" });
    const res = await request(app)
      .post("/api/focus")
      .send({ projectId: id });
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await request(app)
      .post("/api/focus")
      .send({ projectId: "nonexistent", goal: "test" });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/focus/:id", () => {
  it("toggles completion", async () => {
    const id = await seedProject(db, { pathHash: "focus-3" });
    const createRes = await request(app)
      .post("/api/focus")
      .send({ projectId: id, goal: "Write tests" });
    const { focus } = createRes.body;

    const updateRes = await request(app)
      .put(`/api/focus/${focus.id}`)
      .send({ completed: true });
    expect(updateRes.body.ok).toBe(true);
    expect(updateRes.body.focus.completed).toBe(true);
  });

  it("returns 404 for nonexistent focus goal", async () => {
    const res = await request(app)
      .put("/api/focus/nonexistent")
      .send({ completed: true });
    expect(res.status).toBe(404);
  });
});

// ── Visit ──────────────────────────────────────────────────

describe("GET /api/visit (first visit)", () => {
  it("returns firstVisit=true when no previous snapshot", async () => {
    const res = await request(app).get("/api/visit");
    expect(res.body.ok).toBe(true);
    expect(res.body.firstVisit).toBe(true);
    expect(res.body.delta).toBeNull();
  });
});

describe("POST /api/visit", () => {
  it("saves current project state as snapshot", async () => {
    await seedProject(db, { pathHash: "visit-1" });
    const res = await request(app).post("/api/visit");
    expect(res.body.ok).toBe(true);
    expect(res.body.projectCount).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/visit (subsequent visit)", () => {
  it("returns delta after saving a snapshot", async () => {
    await seedProject(db, { pathHash: "visit-2" });
    // Save snapshot
    await request(app).post("/api/visit");
    // Now get delta
    const res = await request(app).get("/api/visit");
    expect(res.body.ok).toBe(true);
    expect(res.body.firstVisit).toBe(false);
    expect(res.body.delta).toBeDefined();
  });
});

// ── Shipped ────────────────────────────────────────────────

describe("GET /api/shipped", () => {
  it("returns aggregate commit counts", async () => {
    const res = await request(app).get("/api/shipped");
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.weekTotal).toBe("number");
    expect(typeof res.body.monthTotal).toBe("number");
    expect(typeof res.body.quarterTotal).toBe("number");
    expect(Array.isArray(res.body.projects)).toBe(true);
  });
});

// ── Snooze/Archive via Override ────────────────────────────

describe("PATCH /api/projects/:id/override (snooze/archive/revive)", () => {
  it("snoozes a project with snoozedUntil", async () => {
    const id = await seedProject(db, { pathHash: "override-snooze" });
    const snoozeDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .patch(`/api/projects/${id}/override`)
      .send({ snoozedUntil: snoozeDate });
    expect(res.body.ok).toBe(true);
  });

  it("archives a project with archivedNote", async () => {
    const id = await seedProject(db, { pathHash: "override-archive" });
    const res = await request(app)
      .patch(`/api/projects/${id}/override`)
      .send({ statusOverride: "archived", archivedNote: "Learned a lot from this" });
    expect(res.body.ok).toBe(true);
  });

  it("revives a project by clearing snoozedUntil and statusOverride", async () => {
    const id = await seedProject(db, { pathHash: "override-revive" });
    const res = await request(app)
      .patch(`/api/projects/${id}/override`)
      .send({ statusOverride: null, snoozedUntil: null });
    expect(res.body.ok).toBe(true);
  });
});