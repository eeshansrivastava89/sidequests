import { Router } from "express";
import { db } from "@/lib/db";
import { mergeAllProjects, mergeAllProjectsLean, computePortfolioStats } from "@/lib/merge";
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
      res.status(500).json({ ok: false, error: "Failed to parse stored analysis" });
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
    res.status(500).json({ ok: false, error: msg });
  }
});

// POST /api/portfolio/analysis — re-run portfolio LLM analysis and save to DB
portfolioRoute.post("/analysis", async (_req, res) => {
  try {
    const provider = getLlmProvider();
    if (!provider) {
      res.status(400).json({ ok: false, error: "No LLM provider configured" });
      return;
    }

    // Check that at least some projects have LLM data
    const projects = await mergeAllProjectsLean();
    const hasLlm = projects.some((p) => p.nextAction || p.summary);
    if (!hasLlm) {
      res.status(400).json({ ok: false, error: "No LLM data yet. Run an AI scan first." });
      return;
    }

    await runPortfolioAnalysis();

    // Fetch the newly saved analysis
    const row = await db.portfolioAnalysis.findFirst({
      orderBy: { generatedAt: "desc" },
    });

    if (!row) {
      res.status(500).json({ ok: false, error: "Analysis failed to save" });
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(row.resultJson);
    } catch {
      res.status(500).json({ ok: false, error: "Failed to parse analysis result" });
      return;
    }

    res.json({ ok: true, ...parsed, cached: false, generatedAt: row.generatedAt.toISOString() });
  } catch (error) {
    console.error("[portfolio/analysis POST]", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/portfolio/stats — compute portfolio statistics (no LLM, deterministic)
portfolioRoute.get("/stats", async (_req, res) => {
  const projects = await mergeAllProjects();
  const stats = computePortfolioStats(projects);
  res.json({ ok: true, ...stats });
});