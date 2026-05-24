import { Hono } from "hono";
import { db } from "@/lib/db";

export const dismissAlertRoute = new Hono();

// POST /api/projects/:id/dismiss-alert — dismiss a specific alert type
dismissAlertRoute.post("/:id/dismiss-alert", async (c) => {
  const id = c.req.param("id");
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return c.json({ ok: false, error: "Project not found" }, 404);
  }

  const body = await c.req.json();
  const alertType = body.alertType as string;
  if (!alertType) {
    return c.json({ ok: false, error: "alertType is required" }, 400);
  }

  const dismissed = await db.dismissedAlert.upsert({
    where: { projectId_alertType: { projectId: id, alertType } },
    create: { projectId: id, alertType },
    update: { dismissedAt: new Date() },
  });

  return c.json({ ok: true, dismissed });
});

// DELETE /api/projects/:id/dismiss-alert — re-show a previously dismissed alert
dismissAlertRoute.delete("/:id/dismiss-alert", async (c) => {
  const id = c.req.param("id");
  const alertType = c.req.query("alertType");
  if (!alertType) {
    return c.json({ ok: false, error: "alertType query parameter is required" }, 400);
  }

  try {
    await db.dismissedAlert.delete({
      where: { projectId_alertType: { projectId: id, alertType } },
    });
    return c.json({ ok: true });
  } catch {
    // Already doesn't exist — that's fine
    return c.json({ ok: true });
  }
});