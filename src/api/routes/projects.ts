import { Hono } from "hono";
import { db } from "@/lib/db";
import { mergeAllProjects } from "@/lib/merge";

export const projectsRoute = new Hono();

// GET /api/projects — list all projects with merged data
projectsRoute.get("/", async (c) => {
  const [projects, lastScan] = await Promise.all([
    mergeAllProjects(),
    db.scan.findFirst({ orderBy: { scannedAt: "desc" }, select: { scannedAt: true } }),
  ]);
  const lastRefreshedAt = lastScan?.scannedAt?.toISOString() ?? null;
  return c.json({ ok: true, projects, lastRefreshedAt });
});