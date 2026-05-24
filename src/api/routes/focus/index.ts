import { Hono } from "hono";
import { db } from "@/lib/db";

export const focusRoute = new Hono();

// Helper: get the Monday 00:00 of the current week
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d;
}

// GET /api/focus — weekly focus goals for current week
focusRoute.get("/", async (c) => {
  const weekStart = getWeekStart(new Date());

  const goals = await db.weeklyFocus.findMany({
    where: { weekStart: { gte: weekStart } },
    orderBy: { createdAt: "asc" },
    include: { project: { select: { id: true, name: true } } },
  });

  return c.json({
    ok: true,
    weekStart: weekStart.toISOString(),
    goals: goals.map((g) => ({
      id: g.id,
      projectId: g.projectId,
      projectName: g.project.name,
      goal: g.goal,
      completed: g.completed,
      weekStart: g.weekStart.toISOString(),
      createdAt: g.createdAt.toISOString(),
    })),
  });
});

// POST /api/focus — create a new weekly focus goal
focusRoute.post("/", async (c) => {
  const body = await c.req.json();
  const { projectId, goal } = body;

  if (!projectId || !goal || typeof goal !== "string" || goal.trim().length === 0) {
    return c.json({ ok: false, error: "projectId and goal are required" }, 400);
  }

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return c.json({ ok: false, error: "Project not found" }, 404);
  }

  const weekStart = getWeekStart(new Date());

  const focus = await db.weeklyFocus.create({
    data: { projectId, goal: goal.trim(), weekStart },
  });

  return c.json({ ok: true, focus });
});

// PUT /api/focus/:id — update a focus goal (toggle completion or edit text)
focusRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const data: { goal?: string; completed?: boolean } = {};
  if (body.goal !== undefined && typeof body.goal === "string") data.goal = body.goal.trim();
  if (body.completed !== undefined && typeof body.completed === "boolean") data.completed = body.completed;

  if (Object.keys(data).length === 0) {
    return c.json({ ok: false, error: "Provide goal or completed to update" }, 400);
  }

  try {
    const focus = await db.weeklyFocus.update({ where: { id }, data });
    return c.json({ ok: true, focus });
  } catch {
    return c.json({ ok: false, error: "Focus goal not found" }, 404);
  }
});