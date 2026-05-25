import { Router } from "express";
import { db } from "@/lib/db";

export const shippedRoute = Router();

// GET /api/shipped — aggregate commit counts across the portfolio
shippedRoute.get("/", async (_req, res) => {
  const derivedRows = await db.derived.findMany({
    where: { project: { prunedAt: null } },
    select: {
      projectId: true,
      weekCommits: true,
      monthCommits: true,
      quarterCommits: true,
      project: { select: { name: true } },
    },
  });

  let weekTotal = 0;
  let monthTotal = 0;
  let quarterTotal = 0;

  const projects = derivedRows.map((d) => {
    weekTotal += d.weekCommits;
    monthTotal += d.monthCommits;
    quarterTotal += d.quarterCommits;
    return {
      id: d.projectId,
      name: d.project.name,
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