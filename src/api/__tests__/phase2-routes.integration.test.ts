/**
 * Integration tests for Phase 2 routes: dismiss-alert, focus, visit, shipped.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb, TEST_DB_PATH } from "@/lib/__tests__/helpers/test-db";
import { seedProject } from "@/lib/__tests__/helpers/fixtures";

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
let app: Awaited<ReturnType<typeof import("@/api/index")>>["app"];

beforeAll(async () => {
  const { bootstrapDb } = await import("../../../../bin/bootstrap-db.mjs");
  await bootstrapDb(TEST_DB_PATH);
  db = await getTestDb();
  const mod = await import("@/api/index");
  app = mod.app;
});

beforeEach(async () => {
  await cleanDb(db);
});

// ── Dismiss Alert ──────────────────────────────────────────

describe("POST /api/projects/:id/dismiss-alert", () => {
  it("creates a dismissed alert", async () => {
    const id = await seedProject(db, { pathHash: "dismiss-1" });
    const res = await app.request(`/api/projects/${id}/dismiss-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertType: "git-urgent" }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dismissed.alertType).toBe("git-urgent");
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await app.request("/api/projects/nonexistent/dismiss-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertType: "git-urgent" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 if alertType is missing", async () => {
    const id = await seedProject(db, { pathHash: "dismiss-2" });
    const res = await app.request(`/api/projects/${id}/dismiss-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/projects/:id/dismiss-alert", () => {
  it("deletes a dismissed alert", async () => {
    const id = await seedProject(db, { pathHash: "dismiss-3" });
    // Create it first
    await app.request(`/api/projects/${id}/dismiss-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertType: "git-warning" }),
    });
    // Then delete it
    const res = await app.request(`/api/projects/${id}/dismiss-alert?alertType=git-warning`, {
      method: "DELETE",
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 400 if alertType query param is missing", async () => {
    const res = await app.request("/api/projects/any/dismiss-alert", {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });
});

// ── Focus ──────────────────────────────────────────────────

describe("GET /api/focus", () => {
  it("returns empty focus list", async () => {
    const res = await app.request("/api/focus");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.goals).toEqual([]);
    expect(body.weekStart).toBeDefined();
  });
});

describe("POST /api/focus", () => {
  it("creates a weekly focus goal", async () => {
    const id = await seedProject(db, { pathHash: "focus-1" });
    const res = await app.request("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, goal: "Ship auth feature" }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.focus.goal).toBe("Ship auth feature");
    expect(body.focus.completed).toBe(false);
  });

  it("returns 400 if goal is missing", async () => {
    const id = await seedProject(db, { pathHash: "focus-2" });
    const res = await app.request("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent project", async () => {
    const res = await app.request("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "nonexistent", goal: "test" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/focus/:id", () => {
  it("toggles completion", async () => {
    const id = await seedProject(db, { pathHash: "focus-3" });
    const createRes = await app.request("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, goal: "Write tests" }),
    });
    const { focus } = await createRes.json();

    const updateRes = await app.request(`/api/focus/${focus.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    const updateBody = await updateRes.json();
    expect(updateBody.ok).toBe(true);
    expect(updateBody.focus.completed).toBe(true);
  });

  it("returns 404 for nonexistent focus goal", async () => {
    const res = await app.request("/api/focus/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect(res.status).toBe(404);
  });
});

// ── Visit ──────────────────────────────────────────────────

describe("GET /api/visit (first visit)", () => {
  it("returns firstVisit=true when no previous snapshot", async () => {
    const res = await app.request("/api/visit");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.firstVisit).toBe(true);
    expect(body.delta).toBeNull();
  });
});

describe("POST /api/visit", () => {
  it("saves current project state as snapshot", async () => {
    await seedProject(db, { pathHash: "visit-1" });
    const res = await app.request("/api/visit", { method: "POST" });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.projectCount).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/visit (subsequent visit)", () => {
  it("returns delta after saving a snapshot", async () => {
    await seedProject(db, { pathHash: "visit-2" });
    // Save snapshot
    await app.request("/api/visit", { method: "POST" });
    // Now get delta
    const res = await app.request("/api/visit");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.firstVisit).toBe(false);
    expect(body.delta).toBeDefined();
  });
});

// ── Shipped ────────────────────────────────────────────────

describe("GET /api/shipped", () => {
  it("returns aggregate commit counts", async () => {
    const res = await app.request("/api/shipped");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.weekTotal).toBe("number");
    expect(typeof body.monthTotal).toBe("number");
    expect(typeof body.quarterTotal).toBe("number");
    expect(Array.isArray(body.projects)).toBe(true);
  });
});

// ── Snooze/Archive via Override ────────────────────────────

describe("PATCH /api/projects/:id/override (snooze/archive/revive)", () => {
  it("snoozes a project with snoozedUntil", async () => {
    const id = await seedProject(db, { pathHash: "override-snooze" });
    const snoozeDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await app.request(`/api/projects/${id}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snoozedUntil: snoozeDate }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("archives a project with archivedNote", async () => {
    const id = await seedProject(db, { pathHash: "override-archive" });
    const res = await app.request(`/api/projects/${id}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusOverride: "archived", archivedNote: "Learned a lot from this" }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("revives a project by clearing snoozedUntil and statusOverride", async () => {
    const id = await seedProject(db, { pathHash: "override-revive" });
    const res = await app.request(`/api/projects/${id}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusOverride: null, snoozedUntil: null }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});