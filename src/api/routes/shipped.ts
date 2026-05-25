import { Router } from "express";
import { db } from "@/lib/db";

export const shippedRoute = Router();

// GET /api/shipped — aggregate commit counts across the portfolio
shippedRoute.get("/", async (_req, res) => {
  const derivedRows = await db.derived.findMany({
    select: {
      projectId: true,
      weekCommits: true,
      monthCommits: true,
      quarterCommits: true,
    },
  });

  const project = await db.project.findMany({
    where: { prunedAt: null },
    select: { id: true, name: true },
  });

  const projectMap = new Map(project.map((p) => [p.id, p.name]));

  let weekTotal = 0;
  let monthTotal = 0;
  let quarterTotal = 0;

  const projects = derivedRows.map((d) => {
    weekTotal += d.weekCommits;
    monthTotal += d.monthCommits;
    quarterTotal += d.quarterCommits;
    return {
      id: d.projectId,
      name: projectMap.get(d.projectId) ?? "Unknown",
      weekCommits: d.weekCommits,
      monthCommits: d.monthCommits,
      quarterCommits: d.quarterCommits,
    };
  });

  res.json({
    ok: true,
    weekTotal,
    monthTotal,
    quarterTotal,
    projects,
  });
});