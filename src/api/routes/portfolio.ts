import { Router } from "express";
import { db } from "@/lib/db";
import { mergeAllProjects } from "@/lib/merge";
import { getLlmProvider } from "@/lib/llm";
import { runPortfolioAnalysis } from "@/lib/pipeline";

export const portfolioRoute = Router();

// GET /api/portfolio/analysis — return persisted portfolio analysis from DB
portfolioRoute.get("/analysis", async (_req, res) => {
  try {
    const row = await db.portfolioAnalysis.findFirst({
      orderBy: { generatedAt: "desc" },
    });

    if (!row) {
      res.json({ ok: true, recommendation: null, secondary: [], portfolioInsights: [] });
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(row.resultJson);
    } catch {
      res.json({ ok: false, error: "Failed to parse stored analysis" });
      return;
    }

    res.json({ ok: true, ...parsed, cached: true, generatedAt: row.generatedAt.toISOString() });
  } catch (error) {
    // Gracefully handle missing table (e.g. before first migration)
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("no such table")) {
      res.json({ ok: true, recommendation: null, secondary: [], portfolioInsights: [] });
      return;
    }
    console.error("[portfolio/analysis GET]", error);
    res.json({ ok: false, error: String(error) });
  }
});

// POST /api/portfolio/analysis — re-run portfolio LLM analysis and save to DB
portfolioRoute.post("/analysis", async (_req, res) => {
  try {
    const provider = getLlmProvider();
    if (!provider) {
      res.json({ ok: false, error: "No LLM provider configured" });
      return;
    }

    // Check that at least some projects have LLM data
    const projects = await mergeAllProjects();
    const hasLlm = projects.some((p) => p.nextAction || p.summary);
    if (!hasLlm) {
      res.json({ ok: false, error: "No LLM data yet. Run an AI scan first." });
      return;
    }

    await runPortfolioAnalysis();

    // Fetch the newly saved analysis
    const row = await db.portfolioAnalysis.findFirst({
      orderBy: { generatedAt: "desc" },
    });

    if (!row) {
      res.json({ ok: false, error: "Analysis failed to save" });
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(row.resultJson);
    } catch {
      res.json({ ok: false, error: "Failed to parse analysis result" });
      return;
    }

    res.json({ ok: true, ...parsed, cached: false, generatedAt: row.generatedAt.toISOString() });
  } catch (error) {
    console.error("[portfolio/analysis POST]", error);
    res.json({ ok: false, error: String(error) });
  }
});

// GET /api/portfolio/stats — compute portfolio statistics (no LLM, deterministic)
portfolioRoute.get("/stats", async (_req, res) => {
  const projects = await mergeAllProjects();

  // Status distribution
  const statusCounts: Record<string, number> = {};
  for (const p of projects) {
    const s = p.llmStatus ?? p.status;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  // Commit velocity per project
  const velocity = projects
    .filter((p) => p.status !== "archived")
    .map((p) => ({
      id: p.id,
      name: p.name,
      week: p.weekCommits,
      month: p.monthCommits,
      quarter: p.quarterCommits,
      healthScore: p.healthScore,
      status: p.llmStatus ?? p.status,
    }))
    .sort((a, b) => b.quarter - a.quarter);

  // Momentum classification
  const momentum = { accelerating: 0, steady: 0, decelerating: 0, stalled: 0 };
  const momentumProjects: Record<string, string[]> = {
    accelerating: [],
    steady: [],
    decelerating: [],
    stalled: [],
  };

  for (const p of velocity) {
    let m: string;
    if (p.quarter === 0) {
      m = "stalled";
    } else if (p.week >= (p.month / 4) * 1.3) {
      m = "accelerating";
    } else if (p.week <= (p.month / 4) * 0.5) {
      m = "decelerating";
    } else {
      m = "steady";
    }
    momentum[m as keyof typeof momentum]++;
    momentumProjects[m as keyof typeof momentumProjects].push(p.name);
  }

  // Totals
  const totals = {
    projects: projects.length,
    weekCommits: velocity.reduce((s, p) => s + p.week, 0),
    monthCommits: velocity.reduce((s, p) => s + p.month, 0),
    quarterCommits: velocity.reduce((s, p) => s + p.quarter, 0),
  };

  // Signals
  const dirty = projects.filter((p) => p.isDirty).length;
  const ciFailing = projects.filter((p) => p.ciStatus === "failure").length;
  const openIssues = projects.reduce((s, p) => s + p.openIssues, 0);
  const notOnGitHub = projects.filter((p) => p.repoVisibility === "not-on-github").length;

  // Top projects by commits
  const topActive = velocity.filter((p) => p.quarter > 0).slice(0, 8);
  const stalled = velocity.filter((p) => p.quarter === 0);

  res.json({
    ok: true,
    statusCounts,
    velocity,
    totals,
    momentum,
    momentumProjects,
    signals: { dirty, ciFailing, openIssues, notOnGitHub },
    topActive,
    stalled,
  });
});