import { Router } from "express";
import { mergeAllProjects } from "@/lib/merge";
import { getLlmProvider } from "@/lib/llm";

export const portfolioRoute = Router();

// Simple in-memory cache: { result, timestamp }
let analysisCache: { result: Record<string, unknown>; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

import portfolioSystemPrompt from "@/config/prompts/portfolio-system.md?raw";

interface ProjectSummary {
  name: string;
  status: string;
  statusReason: string | null;
  nextAction: string | null;
  healthScore: number;
  weekCommits: number;
  monthCommits: number;
  quarterCommits: number;
  openIssues: number;
  ciStatus: string;
  isDirty: boolean;
  summary: string | null;
  insights: Array<{ text: string; severity: string }>;
  goal: string | null;
}

// GET /api/portfolio/analysis — run portfolio-level LLM analysis
portfolioRoute.get("/analysis", async (_req, res) => {
  try {
    const provider = getLlmProvider();
    if (!provider) {
      res.json({ ok: false, error: "No LLM provider configured" });
      return;
    }

    // Check in-memory cache
    if (analysisCache && Date.now() - analysisCache.timestamp < CACHE_TTL) {
      res.json({ ok: true, ...analysisCache.result, cached: true });
      return;
    }

    // Gather project summaries
    const projects = await mergeAllProjects();

    const summaries: ProjectSummary[] = projects.map((p) => ({
      name: p.name,
      status: p.llmStatus ?? p.status,
      statusReason: p.statusReason ?? null,
      nextAction: p.nextAction ?? null,
      healthScore: p.healthScore,
      weekCommits: p.weekCommits,
      monthCommits: p.monthCommits,
      quarterCommits: p.quarterCommits,
      openIssues: p.openIssues,
      ciStatus: p.ciStatus,
      isDirty: p.isDirty,
      summary: p.summary ?? null,
      insights: p.insights ?? [],
      goal: p.goal ?? null,
    }));

    const prompt = `${portfolioSystemPrompt}

Projects (${summaries.length} total):

${summaries
  .map((p) => {
    const parts = [
      `## ${p.name}`,
      `Status: ${p.status}${p.statusReason ? ` (${p.statusReason})` : ""}`,
      `Health: ${p.healthScore}/100`,
      `Commits: ${p.weekCommits}/7d, ${p.monthCommits}/30d, ${p.quarterCommits}/90d`,
    ];
    if (p.openIssues > 0) parts.push(`Open Issues: ${p.openIssues}`);
    if (p.ciStatus === "failure") parts.push("CI: FAILING");
    if (p.isDirty) parts.push("Dirty: yes (uncommitted changes)");
    if (p.nextAction) parts.push(`Next Action: ${p.nextAction}`);
    if (p.summary) parts.push(`Summary: ${p.summary}`);
    if (p.insights.length > 0) parts.push(`Insights: ${p.insights.map((i) => `[${i.severity}] ${i.text}`).join("; ")}`);
    if (p.goal) parts.push(`Goal: ${p.goal}`);
    return parts.join("\n");
  })
  .join("\n\n")}`;

    const result = await provider.analyze(prompt);

    // Parse the result
    let parsed: Record<string, unknown>;
    try {
      parsed = typeof result === "string" ? JSON.parse(result) : result;
    } catch {
      const match = String(result).match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = { error: "Failed to parse LLM response" }; }
      } else {
        parsed = { error: "Failed to parse LLM response" };
      }
    }

    // Cache the result in memory
    analysisCache = { result: parsed, timestamp: Date.now() };

    res.json({ ok: true, ...parsed, cached: false });
  } catch (error) {
    console.error("[portfolio/analysis]", error);
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