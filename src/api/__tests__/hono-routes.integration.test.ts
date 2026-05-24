/**
 * Hono API integration tests.
 *
 * These tests verify that the Hono route handlers behave identically
 * to the Next.js route handlers they'll replace.
 *
 * Pattern: Use Hono's app.request() to test routes without an HTTP server.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { getTestDb, cleanDb, TEST_DB_PATH } from "@/lib/__tests__/helpers/test-db";
import { seedProject } from "@/lib/__tests__/helpers/fixtures";

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
let app: Awaited<ReturnType<typeof import("@/api/index")>>["app"];

beforeAll(async () => {
  // Ensure DB schema is current by running bootstrap migrations
  const { bootstrapDb } = await import("../../../../bin/bootstrap-db.mjs");
  await bootstrapDb(TEST_DB_PATH);

  db = await getTestDb();
  const mod = await import("@/api/index");
  app = mod.app;
});

beforeEach(async () => {
  await cleanDb(db);
});

// ── Projects list ─────────────────────────────────────────

describe("Hono GET /api/projects", () => {
  it("returns empty list when no projects exist", async () => {
    const res = await app.request("/api/projects");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.projects).toEqual([]);
  });

  it("returns projects with merged data", async () => {
    await seedProject(db, { pathHash: "h-hono-1" });
    const res = await app.request("/api/projects");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].name).toBe("test-project");
  });
});

// ── Project detail ───────────────────────────────────────

describe("Hono GET /api/projects/:id", () => {
  it("returns 404 for nonexistent project", async () => {
    const res = await app.request("/api/projects/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns project with merged data", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-2" });
    const res = await app.request(`/api/projects/${id}`);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.project.id).toBe(id);
  });
});

// ── Override ───────────────────────────────────────────────

describe("Hono PATCH /api/projects/:id/override", () => {
  it("upserts valid string fields and logs activity", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-ov1" });

    const res = await app.request(`/api/projects/${id}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusOverride: "paused" }),
    });
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.override.statusOverride).toBe("paused");

    const activity = await db.activity.findFirst({ where: { projectId: id, type: "override" } });
    expect(activity).not.toBeNull();
  });

  it("JSON coercion — tagsOverride as array is stored as JSON string", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-ov2" });

    const res = await app.request(`/api/projects/${id}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagsOverride: ["a", "b"] }),
    });
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.override.tagsOverride).toBe(JSON.stringify(["a", "b"]));
  });

  it("400 on empty body", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-ov3" });

    const res = await app.request(`/api/projects/${id}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("404 for nonexistent project", async () => {
    const res = await app.request("/api/projects/nonexistent/override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusOverride: "active" }),
    });

    expect(res.status).toBe(404);
  });
});

// ── Pin ───────────────────────────────────────────────────

describe("Hono PATCH /api/projects/:id/pin", () => {
  it("toggles pin state", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-pin" });

    const res1 = await app.request(`/api/projects/${id}/pin`, { method: "PATCH" });
    const body1 = await res1.json();
    expect(body1.ok).toBe(true);
    expect(body1.pinned).toBe(true);

    const res2 = await app.request(`/api/projects/${id}/pin`, { method: "PATCH" });
    const body2 = await res2.json();
    expect(body2.pinned).toBe(false);
  });

  it("404 for missing project", async () => {
    const res = await app.request("/api/projects/nonexistent/pin", { method: "PATCH" });
    expect(res.status).toBe(404);
  });
});

// ── Touch ─────────────────────────────────────────────────

describe("Hono POST /api/projects/:id/touch", () => {
  it("updates lastTouchedAt and logs activity", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-touch" });
    const before = await db.project.findUnique({ where: { id } });

    const res = await app.request(`/api/projects/${id}/touch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "vscode" }),
    });
    const body = await res.json();
    expect(body.ok).toBe(true);

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

describe("Hono PATCH /api/projects/:id/metadata", () => {
  it("upserts valid fields and logs activity", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-md1" });

    const res = await app.request(`/api/projects/${id}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Ship v1" }),
    });
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.metadata.goal).toBe("Ship v1");

    const activity = await db.activity.findFirst({ where: { projectId: id, type: "metadata" } });
    expect(activity).not.toBeNull();
  });

  it("400 on empty body", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-md2" });
    const res = await app.request(`/api/projects/${id}/metadata`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

// ── Activity ──────────────────────────────────────────────

describe("Hono GET /api/projects/:id/activity", () => {
  it("returns activity for a project", async () => {
    const id = await seedProject(db, { pathHash: "h-hono-act" });
    // Seed some activity
    await db.activity.create({
      data: { projectId: id, type: "scan", payloadJson: JSON.stringify({ scannedAt: new Date().toISOString() }) },
    });

    const res = await app.request(`/api/projects/${id}/activity`);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.activities).toHaveLength(1);
    expect(body.activities[0].type).toBe("scan");
  });

  it("404 for missing project", async () => {
    const res = await app.request("/api/projects/nonexistent/activity");
    expect(res.status).toBe(404);
  });
});

// ── Simple routes ─────────────────────────────────────────

describe("Hono simple routes", () => {
  it("GET /api/health returns ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ts).toBeDefined();
  });

  it("GET /api/config returns empty object", async () => {
    const res = await app.request("/api/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });

  it("GET /api/preflight returns checks array", async () => {
    const res = await app.request("/api/preflight");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks).toBeDefined();
    expect(body.checks.length).toBeGreaterThan(0);
  });

  it("GET /api/version returns version info", async () => {
    const res = await app.request("/api/version");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBeDefined();
    expect(typeof body.updateAvailable).toBe("boolean");
  });
});