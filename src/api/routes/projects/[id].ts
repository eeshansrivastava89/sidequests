import { Router } from "express";
import { db } from "@/lib/db";
import { mergeProjectView } from "@/lib/merge";
import { coercePatchBody, safeJsonParse } from "@/lib/api-helpers";

export const projectByIdRoute = Router();

// ── GET /api/projects/:id ─────────────────────────────────

projectByIdRoute.get("/:id", async (req, res) => {
  const project = await mergeProjectView(req.params.id);
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }
  res.json({ ok: true, project });
});

// ── PATCH /api/projects/:id/override ─────────────────────

const OVERRIDE_FIELDS = {
  jsonFields: new Set(["tagsOverride"]),
  stringFields: new Set(["statusOverride", "purposeOverride", "notesOverride"]),
};

projectByIdRoute.patch("/:id/override", async (req, res) => {
  const { id } = req.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  const body = req.body;

  // Separate Project-level fields from Override fields
  const projectFields: Record<string, string | null> = {};
  if ("snoozedUntil" in body) projectFields.snoozedUntil = body.snoozedUntil as string | null;
  if ("archivedNote" in body) projectFields.archivedNote = body.archivedNote as string | null;

  // Update Project-level snooze/archive fields if provided
  if (Object.keys(projectFields).length > 0) {
    const update: Record<string, unknown> = {};
    if ("snoozedUntil" in projectFields) {
      update.snoozedUntil = projectFields.snoozedUntil ? new Date(projectFields.snoozedUntil) : null;
    }
    if ("archivedNote" in projectFields) {
      update.archivedNote = projectFields.archivedNote ?? null;
    }
    await db.project.update({ where: { id }, data: update });
  }

  // Coerce override fields — may be empty if only project-level fields were sent
  const result = coercePatchBody(body, OVERRIDE_FIELDS);

  // Only upsert Override if there are override fields
  if (result.data && Object.keys(result.data).length > 0) {
    const override = await db.override.upsert({
      where: { projectId: id },
      create: { projectId: id, ...result.data },
      update: result.data,
    });

    await db.activity.create({
      data: { projectId: id, type: "override", payloadJson: JSON.stringify(result.data) },
    });

    res.json({ ok: true, override });
    return;
  }

  // Only project-level fields were provided
  if (result.error && Object.keys(projectFields).length > 0) {
    res.json({ ok: true, projectFields: Object.keys(projectFields) });
    return;
  }

  // No valid fields at all
  if (result.error) {
    res.status(result.status).json({ ok: false, error: result.error });
    return;
  }

  res.json({ ok: true, projectFields: Object.keys(projectFields) });
});

// ── PATCH /api/projects/:id/metadata ─────────────────────

const METADATA_FIELDS = {
  jsonFields: new Set<string>(),
  stringFields: new Set(["goal", "audience", "successMetrics", "nextAction", "publishTarget"]),
};

projectByIdRoute.patch("/:id/metadata", async (req, res) => {
  const { id } = req.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  const body = req.body;
  const result = coercePatchBody(body, METADATA_FIELDS);
  if (result.error) {
    res.status(result.status).json({ ok: false, error: result.error });
    return;
  }

  const metadata = await db.metadata.upsert({
    where: { projectId: id },
    create: { projectId: id, ...result.data },
    update: result.data,
  });

  await db.activity.create({
    data: { projectId: id, type: "metadata", payloadJson: JSON.stringify(result.data) },
  });

  res.json({ ok: true, metadata });
});

// ── PATCH /api/projects/:id/pin ──────────────────────────

projectByIdRoute.patch("/:id/pin", async (req, res) => {
  const { id } = req.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  const updated = await db.project.update({
    where: { id },
    data: { pinned: !project.pinned },
  });

  await db.activity.create({
    data: { projectId: id, type: "pin", payloadJson: JSON.stringify({ pinned: updated.pinned }) },
  });

  res.json({ ok: true, pinned: updated.pinned });
});

// ── POST /api/projects/:id/touch ──────────────────────────

projectByIdRoute.post("/:id/touch", async (req, res) => {
  const { id } = req.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  const tool: string = req.body?.tool ?? "unknown";

  await db.project.update({ where: { id }, data: { lastTouchedAt: new Date() } });
  await db.activity.create({
    data: { projectId: id, type: "opened", payloadJson: JSON.stringify({ tool }) },
  });

  res.json({ ok: true });
});

// ── GET /api/projects/:id/activity ────────────────────────

projectByIdRoute.get("/:id/activity", async (req, res) => {
  const { id } = req.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  const activities = await db.activity.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json({
    ok: true,
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      payload: safeJsonParse(a.payloadJson, null),
      createdAt: a.createdAt.toISOString(),
    })),
  });
});