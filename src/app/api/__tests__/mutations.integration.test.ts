import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getTestDb, cleanDb } from "@/lib/__tests__/helpers/test-db";
import { seedProject } from "@/lib/__tests__/helpers/fixtures";

const mockConfig = vi.hoisted(() => ({
  sanitizePaths: false,
  featureO1: false,
}));

vi.mock("@/lib/config", () => ({ config: mockConfig }));
vi.mock("@/lib/settings", () => ({
  getSettings: () => ({}),
  clearSettingsCache: () => {},
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

type RouteHandler = (...args: unknown[]) => unknown;
let overridePATCH: RouteHandler;
let metadataPATCH: RouteHandler;
let pinPATCH: RouteHandler;
let touchPOST: RouteHandler;

beforeAll(async () => {
  db = await getTestDb();

  const overrideRoute = await import("@/app/api/projects/[id]/override/route");
  overridePATCH = overrideRoute.PATCH;

  const metadataRoute = await import("@/app/api/projects/[id]/metadata/route");
  metadataPATCH = metadataRoute.PATCH;

  const pinRoute = await import("@/app/api/projects/[id]/pin/route");
  pinPATCH = pinRoute.PATCH;

  const touchRoute = await import("@/app/api/projects/[id]/touch/route");
  touchPOST = touchRoute.POST;
});

beforeEach(async () => {
  await cleanDb(db);
});

function jsonReq(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function postReq(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/projects/[id]/override", () => {
  it("upserts valid string fields and logs activity", async () => {
    const id = await seedProject(db, { pathHash: "h-ov1" });

    const res = await overridePATCH(
      jsonReq(`/api/projects/${id}/override`, { statusOverride: "paused" }),
      { params: Promise.resolve({ id }) },
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.override.statusOverride).toBe("paused");

    const activity = await db.activity.findFirst({ where: { projectId: id, type: "override" } });
    expect(activity).not.toBeNull();
  });

  it("JSON coercion — tagsOverride as array is stored as JSON string", async () => {
    const id = await seedProject(db, { pathHash: "h-ov2" });

    const res = await overridePATCH(
      jsonReq(`/api/projects/${id}/override`, { tagsOverride: ["a", "b"] }),
      { params: Promise.resolve({ id }) },
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.override.tagsOverride).toBe(JSON.stringify(["a", "b"]));
  });

  it("JSON coercion — tagsOverride as string accepted as-is", async () => {
    const id = await seedProject(db, { pathHash: "h-ov3" });

    const res = await overridePATCH(
      jsonReq(`/api/projects/${id}/override`, { tagsOverride: '["x"]' }),
      { params: Promise.resolve({ id }) },
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.override.tagsOverride).toBe('["x"]');
  });

  it("400 on empty body", async () => {
    const id = await seedProject(db, { pathHash: "h-ov4" });

    const res = await overridePATCH(
      jsonReq(`/api/projects/${id}/override`, {}),
      { params: Promise.resolve({ id }) },
    );

    expect(res.status).toBe(400);
  });

  it("400 on wrong type (statusOverride: 123)", async () => {
    const id = await seedProject(db, { pathHash: "h-ov5" });

    const res = await overridePATCH(
      jsonReq(`/api/projects/${id}/override`, { statusOverride: 123 }),
      { params: Promise.resolve({ id }) },
    );

    expect(res.status).toBe(400);
  });

  it("404 for nonexistent project", async () => {
    const res = await overridePATCH(
      jsonReq("/api/projects/nonexistent/override", { statusOverride: "active" }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );

    expect(res.status).toBe(404);
  });

  it("upsert idempotency — second call updates same record", async () => {
    const id = await seedProject(db, { pathHash: "h-ov6" });

    await overridePATCH(
      jsonReq(`/api/projects/${id}/override`, { statusOverride: "paused" }),
      { params: Promise.resolve({ id }) },
    );
    await overridePATCH(
      jsonReq(`/api/projects/${id}/override`, { statusOverride: "active" }),
      { params: Promise.resolve({ id }) },
    );

    const overrides = await db.override.findMany({ where: { projectId: id } });
    expect(overrides).toHaveLength(1);
    expect(overrides[0].statusOverride).toBe("active");
  });
});

describe("PATCH /api/projects/[id]/metadata", () => {
  it("upserts valid fields and logs activity", async () => {
    const id = await seedProject(db, { pathHash: "h-md1" });

    const res = await metadataPATCH(
      jsonReq(`/api/projects/${id}/metadata`, { goal: "Ship v1" }),
      { params: Promise.resolve({ id }) },
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.metadata.goal).toBe("Ship v1");

    const activity = await db.activity.findFirst({ where: { projectId: id, type: "metadata" } });
    expect(activity).not.toBeNull();
  });

  it("JSON coercion — evidenceJson as object", async () => {
    const id = await seedProject(db, { pathHash: "h-md2" });

    const res = await metadataPATCH(
      jsonReq(`/api/projects/${id}/metadata`, { evidenceJson: { commits: 50 } }),
      { params: Promise.resolve({ id }) },
    );
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.metadata.evidenceJson).toBe(JSON.stringify({ commits: 50 }));
  });

  it("400 on empty body", async () => {
    const id = await seedProject(db, { pathHash: "h-md3" });
    const res = await metadataPATCH(
      jsonReq(`/api/projects/${id}/metadata`, {}),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(400);
  });

  it("404 for missing project", async () => {
    const res = await metadataPATCH(
      jsonReq("/api/projects/nonexistent/metadata", { goal: "test" }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/projects/[id]/pin", () => {
  it("toggles: unpinned → pinned → unpinned, activity logged each time", async () => {
    const id = await seedProject(db, { pathHash: "h-pin" });

    // Toggle 1: false → true
    const res1 = await pinPATCH(
      new NextRequest("http://localhost/api/projects/" + id + "/pin"),
      { params: Promise.resolve({ id }) },
    );
    const body1 = await res1.json();
    expect(body1.ok).toBe(true);
    expect(body1.pinned).toBe(true);

    // Toggle 2: true → false
    const res2 = await pinPATCH(
      new NextRequest("http://localhost/api/projects/" + id + "/pin"),
      { params: Promise.resolve({ id }) },
    );
    const body2 = await res2.json();
    expect(body2.pinned).toBe(false);

    // 2 pin activities logged
    const activities = await db.activity.findMany({ where: { projectId: id, type: "pin" } });
    expect(activities).toHaveLength(2);
  });

  it("404 for missing project", async () => {
    const res = await pinPATCH(
      new NextRequest("http://localhost/api/projects/nonexistent/pin"),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/projects/[id]/touch", () => {
  it("updates lastTouchedAt and logs activity with tool", async () => {
    const id = await seedProject(db, { pathHash: "h-touch" });
    const before = await db.project.findUnique({ where: { id } });

    const res = await touchPOST(
      postReq(`/api/projects/${id}/touch`, { tool: "vscode" }),
      { params: Promise.resolve({ id }) },
    );
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

  it("404 for missing project", async () => {
    const res = await touchPOST(
      postReq("/api/projects/nonexistent/touch", { tool: "vscode" }),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });

  it("handles missing tool field (defaults to 'unknown')", async () => {
    const id = await seedProject(db, { pathHash: "h-touch2" });

    const res = await touchPOST(
      postReq(`/api/projects/${id}/touch`, {}),
      { params: Promise.resolve({ id }) },
    );
    const body = await res.json();
    expect(body.ok).toBe(true);

    const activity = await db.activity.findFirst({ where: { projectId: id, type: "opened" } });
    expect(JSON.parse(activity.payloadJson).tool).toBe("unknown");
  });
});
