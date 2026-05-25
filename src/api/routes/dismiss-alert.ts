import { Router } from "express";
import { db } from "@/lib/db";

export const dismissAlertRoute = Router();

// POST /api/projects/:id/dismiss-alert — dismiss a specific alert type
dismissAlertRoute.post("/:id/dismiss-alert", async (req, res) => {
  const { id } = req.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  const { alertType } = req.body;
  if (!alertType) {
    res.status(400).json({ ok: false, error: "alertType is required" });
    return;
  }

  const dismissed = await db.dismissedAlert.upsert({
    where: { projectId_alertType: { projectId: id, alertType } },
    create: { projectId: id, alertType },
    update: { dismissedAt: new Date() },
  });

  res.json({ ok: true, dismissed });
});

// DELETE /api/projects/:id/dismiss-alert — re-show a previously dismissed alert
dismissAlertRoute.delete("/:id/dismiss-alert", async (req, res) => {
  const { id } = req.params;
  const { alertType } = req.query;
  if (!alertType) {
    res.status(400).json({ ok: false, error: "alertType query parameter is required" });
    return;
  }

  try {
    await db.dismissedAlert.delete({
      where: { projectId_alertType: { projectId: id, alertType: alertType as string } },
    });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("No")) {
      res.json({ ok: true });
    } else {
      console.error("[dismiss-alert DELETE]", err);
      res.status(500).json({ ok: false, error: msg });
    }
  }
});