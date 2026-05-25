import { Router } from "express";
import { db } from "@/lib/db";
import { mergeAllProjects } from "@/lib/merge";
import { computeActions, filterActions, isSnoozed } from "@/lib/actions";

export const projectsRoute = Router();

// GET /api/projects — list all projects with merged data, actions, and shipped counts
projectsRoute.get("/", async (_req, res) => {
  const [projects, lastScan, dismissedAlerts] = await Promise.all([
    mergeAllProjects(),
    db.scan.findFirst({ orderBy: { scannedAt: "desc" }, select: { scannedAt: true } }),
    db.dismissedAlert.findMany({ select: { projectId: true, alertType: true } }),
  ]);

  const now = new Date();

  // Filter out snoozed projects (they're still returned but flagged)
  const enrichedProjects = projects.map((p) => {
    const actions = computeActions(p);
    const filteredActions = filterActions(actions, dismissedAlerts);
    return {
      ...p,
      actions: filteredActions,
      isSnoozed: isSnoozed(p, now),
    };
  });

  const lastRefreshedAt = lastScan?.scannedAt?.toISOString() ?? null;
  res.json({ ok: true, projects: enrichedProjects, lastRefreshedAt });
});