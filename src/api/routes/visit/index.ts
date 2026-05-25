import { Router } from "express";
import { db } from "@/lib/db";
import { mergeAllProjectsLean, snapshotFromProjects, computeVisitDelta, type VisitSnapshot } from "@/lib/merge";

export const visitRoute = Router();

// GET /api/visit — get delta between current project state and last-visit snapshot
visitRoute.get("/", async (_req, res) => {
  // Load last visit snapshot
  const visitRow = await db.userVisit.findUnique({ where: { key: "lastVisit" } });

  // Get current project state
  const currentProjects = await mergeAllProjectsLean();
  const currentSnapshot = snapshotFromProjects(currentProjects);

  if (!visitRow) {
    // No previous visit — return current state as baseline, no delta
    res.json({
      ok: true,
      firstVisit: true,
      current: currentSnapshot,
      delta: null,
    });
    return;
  }

  // Parse previous snapshot
  let previous: VisitSnapshot[];
  try {
    previous = JSON.parse(visitRow.snapshotJson);
  } catch {
    previous = [];
  }

  // Compute delta
  const delta = computeVisitDelta(currentSnapshot, previous);

  res.json({
    ok: true,
    firstVisit: false,
    lastVisitAt: visitRow.updatedAt.toISOString(),
    current: currentSnapshot,
    delta,
  });
});

// POST /api/visit — save current project state as last-visit snapshot
visitRoute.post("/", async (_req, res) => {
  const currentProjects = await mergeAllProjectsLean();

  // Save a lightweight snapshot for delta comparison
  const snapshot = snapshotFromProjects(currentProjects);

  await db.userVisit.upsert({
    where: { key: "lastVisit" },
    create: { key: "lastVisit", snapshotJson: JSON.stringify(snapshot) },
    update: { snapshotJson: JSON.stringify(snapshot) },
  });

  res.json({ ok: true, projectCount: snapshot.length });
});