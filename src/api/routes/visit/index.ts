import { Hono } from "hono";
import { db } from "@/lib/db";
import { mergeAllProjects } from "@/lib/merge";

export const visitRoute = new Hono();

// GET /api/visit — get delta between current project state and last-visit snapshot
visitRoute.get("/", async (c) => {
  // Load last visit snapshot
  const visitRow = await db.userVisit.findUnique({ where: { key: "lastVisit" } });

  // Get current project state
  const currentProjects = await mergeAllProjects();

  if (!visitRow) {
    // No previous visit — return current state as baseline, no delta
    return c.json({
      ok: true,
      firstVisit: true,
      current: currentProjects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        healthScore: p.healthScore,
        weekCommits: p.weekCommits,
        monthCommits: p.monthCommits,
      })),
      delta: null,
    });
  }

  // Parse previous snapshot
  type SnapshotProject = { id: string; name: string; status: string; healthScore: number; weekCommits: number; monthCommits: number };
  let previous: SnapshotProject[];
  try {
    previous = JSON.parse(visitRow.snapshotJson);
  } catch {
    previous = [];
  }

  // Compute delta
  const previousMap = new Map(previous.map((p) => [p.id, p]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ id: string; name: string; field: string; from: unknown; to: unknown }> = [];

  const currentIds = new Set(currentProjects.map((p) => p.id));
  const previousIds = new Map(previous.map((p) => [p.id, p]));

  // New projects
  for (const p of currentProjects) {
    if (!previousIds.has(p.id)) added.push(p.id);
  }

  // Removed projects
  for (const p of previous) {
    if (!currentIds.has(p.id)) removed.push(p.id);
  }

  // Changed fields
  for (const p of currentProjects) {
    const prev = previousMap.get(p.id);
    if (!prev) continue;

    if (p.status !== prev.status) {
      changed.push({ id: p.id, name: p.name, field: "status", from: prev.status, to: p.status });
    }
    if (p.healthScore !== prev.healthScore) {
      changed.push({ id: p.id, name: p.name, field: "healthScore", from: prev.healthScore, to: p.healthScore });
    }
    if (p.weekCommits !== prev.weekCommits) {
      changed.push({ id: p.id, name: p.name, field: "weekCommits", from: prev.weekCommits, to: p.weekCommits });
    }
    if (p.monthCommits !== prev.monthCommits) {
      changed.push({ id: p.id, name: p.name, field: "monthCommits", from: prev.monthCommits, to: p.monthCommits });
    }
  }

  return c.json({
    ok: true,
    firstVisit: false,
    lastVisitAt: visitRow.updatedAt.toISOString(),
    current: currentProjects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      healthScore: p.healthScore,
      weekCommits: p.weekCommits,
      monthCommits: p.monthCommits,
    })),
    delta: { added, removed, changed },
  });
});

// POST /api/visit — save current project state as last-visit snapshot
visitRoute.post("/", async (c) => {
  const currentProjects = await mergeAllProjects();

  // Save a lightweight snapshot for delta comparison
  const snapshot = currentProjects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    healthScore: p.healthScore,
    weekCommits: p.weekCommits,
    monthCommits: p.monthCommits,
  }));

  await db.userVisit.upsert({
    where: { key: "lastVisit" },
    create: { key: "lastVisit", snapshotJson: JSON.stringify(snapshot) },
    update: { snapshotJson: JSON.stringify(snapshot) },
  });

  return c.json({ ok: true, projectCount: snapshot.length });
});