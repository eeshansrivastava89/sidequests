import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config";
import { db } from "./db";
import { getLlmProvider, type LlmEnrichment } from "./llm";
import { tryParseLlmJson } from "./llm/prompt";
import { listProjectDirs, scanProject, type ScannedProject } from "./pipeline-native/scan";
import { deriveProject, type ScanProject as DeriveInput } from "./pipeline-native/derive";
import { fetchGitHubDataAsync, isGhAvailable } from "./pipeline-native/github";
import { parseGitHubOwnerRepo } from "./project-helpers";
import { mergeAllProjects } from "./merge";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "config", "prompts");
const PORTFOLIO_SYSTEM_PROMPT = readFileSync(join(PROMPTS_DIR, "portfolio-system.md"), "utf-8").trim();


/** Build the per-project summary string for the portfolio LLM prompt.
 *
 *  To add a field: add a conditional line below. It will automatically
 *  appear in the portfolio prompt next time the analysis runs.
 *  Fields come from MergedProject — see merge.ts for the full list.
 */
export function buildPortfolioSummary(p: Awaited<ReturnType<typeof mergeAllProjects>>[number]): string {
  const parts = [
    `## ${p.name}`,
    `Status: ${p.llmStatus ?? p.status}${p.statusReason ? ` (${p.statusReason})` : ""}`,
    `Health: ${p.healthScore}/100`,
    `Hygiene: ${p.hygieneScore}/100`,
    `Momentum: ${p.momentumScore}/100`,
    `Commits: ${p.weekCommits}/7d, ${p.monthCommits}/30d, ${p.quarterCommits}/90d`,
  ];
  if (p.openIssues > 0) parts.push(`Open Issues: ${p.openIssues}`);
  if (p.ciStatus === "failure") parts.push("CI: FAILING");
  if (p.isDirty) parts.push("Dirty: yes (uncommitted changes)");
  if (p.nextAction) parts.push(`Next Action: ${p.nextAction}`);
  if (p.summary) parts.push(`Summary: ${p.summary}`);
  if (p.insights.length > 0) parts.push(`Insights: ${p.insights.map((i) => `[${i.severity}] ${i.text}`).join(";")}`);
  if (p.goal) parts.push(`Goal: ${p.goal}`);
  if (p.framework) parts.push(`Framework: ${p.framework}`);
  if (p.primaryLanguage) parts.push(`Language: ${p.primaryLanguage}`);
  // Extra fields from meta (scan/LLM extensible data)
  if (p.meta && Object.keys(p.meta).length > 0) {
    for (const [key, val] of Object.entries(p.meta)) {
      if (val != null && val !== "") parts.push(`${key}: ${val}`);
    }
  }
  return parts.join("\n");
}

/** Run portfolio-level LLM analysis and persist to DB. */
export async function runPortfolioAnalysis(signal?: AbortSignal): Promise<void> {
  const provider = getLlmProvider();
  if (!provider) {
    console.log("[pipeline] No LLM provider — skipping portfolio analysis");
    return;
  }

  const projects = await mergeAllProjects();
  const summaries = projects.map(buildPortfolioSummary);
  const prompt = `${PORTFOLIO_SYSTEM_PROMPT}\n\nProjects (${projects.length} total):\n\n${summaries.join("\n\n")}`;

  if (process.env.NODE_ENV !== "test") {
    console.log(`[pipeline] [portfolio] Running portfolio analysis (${projects.length} projects, ~${prompt.length} chars)...`);
    if (config.llmDebug) {
      console.log(`[pipeline] [portfolio] Prompt:\n${prompt.slice(0, 1200)}${prompt.length > 1200 ? "\n..." : ""}`);
    }
  }

  const startTime = Date.now();
  try {
    const result = await provider.analyze(prompt, signal);
    const durationMs = Date.now() - startTime;

    if (process.env.NODE_ENV !== "test") {
      console.log(`[pipeline] [portfolio] LLM responded in ${(durationMs / 1000).toFixed(1)}s (${String(result).length} chars)`);
      if (config.llmDebug) {
        console.log(`[pipeline] [portfolio] Raw output:\n${String(result).slice(0, 800)}${String(result).length > 800 ? "\n..." : ""}`);
      }
    }

    const parsed = tryParseLlmJson(result);
    if (!parsed) {
      console.error("[pipeline] [portfolio] Failed to parse LLM response as JSON");
      return;
    }

    // Delete previous and create new
    if (process.env.NODE_ENV !== "test") {
      console.log("[pipeline] [portfolio] Saving analysis to DB...");
    }
    await db.portfolioAnalysis.deleteMany({});
    await db.portfolioAnalysis.create({
      data: { resultJson: JSON.stringify(parsed) },
    });
    console.log(`[pipeline] [portfolio] Analysis saved (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`);
  } catch (err) {
    if (signal?.aborted) return;
    const durationMs = Date.now() - startTime;
    console.error(`[pipeline] [portfolio] Failed after ${(durationMs / 1000).toFixed(1)}s:`, err instanceof Error ? err.message : String(err));
  }
}

/** Events emitted during the refresh pipeline. */
export type PipelineEvent =
  | { type: "enumerate_complete"; projectCount: number; names: string[]; pathHashes?: string[]; provider?: string }
  | { type: "project_start"; name: string; pathHash: string; index: number; total: number; step: "store" | "llm"; provider?: string }
  | { type: "project_complete"; name: string; pathHash: string; step: "store" | "llm"; detail?: Record<string, unknown>; lastCommitDate?: string | null; provider?: string }
  | { type: "project_error"; name: string; pathHash: string; step: string; error: string; provider?: string }
  | { type: "done"; projectCount: number; llmSucceeded: number; llmFailed: number; llmFailedNames: string[]; llmSkipped: number; durationMs: number; provider?: string };

function hashRawJson(rawJson: string): string {
  return createHash("sha256").update(rawJson).digest("hex");
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return error instanceof Error && /aborted/i.test(error.message);
}

/**
 * Executes the full pipeline: enumerate → per-project (scan → derive → store → optional GitHub + LLM) → cleanup.
 * Each project completes fully before the next starts.
 */
export async function runRefreshPipeline(
  emit: (event: PipelineEvent) => Promise<void> | void = () => {},
  signal?: AbortSignal,
  options?: { skipLlm?: boolean; selectedNames?: string[] }
): Promise<{ projectCount: number }> {
  const startTime = Date.now();
  let llmSucceeded = 0;
  let llmFailed = 0;
  const llmFailedNames: string[] = [];
  let llmSkipped = 0;

  // 1. Lightweight directory enumeration
  let projectDirs = listProjectDirs(config.devRoot, config.excludeDirs, config.includeNonGitDirs);

  // Scope to selected projects if specified
  if (options?.selectedNames && options.selectedNames.length > 0) {
    const nameSet = new Set(options.selectedNames);
    projectDirs = projectDirs.filter((d) => nameSet.has(d.name));
  }

  // Sort by existing lastTouchedAt (most recently active first) — uses DB data from prior scans
  const existingProjects = await db.project.findMany({
    where: { pathHash: { in: projectDirs.map((d) => d.pathHash) } },
    select: { pathHash: true, lastTouchedAt: true },
  });
  const lastTouchedMap = new Map(existingProjects.map((p) => [p.pathHash, p.lastTouchedAt]));
  projectDirs.sort((a, b) => {
    const aDate = lastTouchedMap.get(a.pathHash);
    const bDate = lastTouchedMap.get(b.pathHash);
    if (!aDate && !bDate) return a.name.localeCompare(b.name);
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  await emit({ type: "enumerate_complete", projectCount: projectDirs.length, names: projectDirs.map((d) => d.name), pathHashes: projectDirs.map((d) => d.pathHash) });

  // 2. Soft-prune missing projects and restore returning ones
  //    Skip when doing a selective scan — we don't want to prune
  //    projects that simply weren't selected.
  const isSelectiveScan = !!(options?.selectedNames && options.selectedNames.length > 0);
  const scannedHashes = new Set(projectDirs.map((d) => d.pathHash));
  if (!isSelectiveScan) {
    await db.project.updateMany({
      where: { pathHash: { notIn: [...scannedHashes] }, prunedAt: null },
      data: { prunedAt: new Date() },
    });
  }
  await db.project.updateMany({
    where: { pathHash: { in: [...scannedHashes] }, prunedAt: { not: null } },
    data: { prunedAt: null },
  });

  const total = projectDirs.length;
  const llmProvider = options?.skipLlm ? null : getLlmProvider();
  const providerName = llmProvider?.name ?? null;
  if (process.env.NODE_ENV !== "test") {
    console.log(`[pipeline] Found ${projectDirs.length} projects in ${config.devRoot}`);
    console.log(`[pipeline] LLM provider: ${providerName ?? "none (skipping LLM)"}`);
  }
  const ghAvailable = isGhAvailable();
  const scannedAt = new Date().toISOString();

  // Track per-project data from pass 1 for use in pass 2 (LLM)
  interface ProjectData {
    dir: typeof projectDirs[number];
    projectId: string;
    name: string;
    scanned: ScannedProject;
    derived?: { statusAuto: string; healthScoreAuto: number; hygieneScoreAuto: number; momentumScoreAuto: number; tags: string[] };
    github?: {
      openIssues: number;
      openPrs: number;
      ciStatus: string;
      repoVisibility: string;
      topIssues?: string;
      topPrs?: string;
    };
  }
  const projectDataList: ProjectData[] = [];

  // Track per-project info for activity log
  const projectLog: Array<{
    projectId: string;
    name: string;
    derived?: { statusAuto: string; healthScoreAuto: number };
    llmResult: "succeeded" | "failed" | "skipped";
  }> = [];

  // ── Pass 1: Fast scan all projects (scan → derive → store → GitHub) ──
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;

    const dir = projectDirs[i];
    const name = dir.name;

    await emit({ type: "project_start", name, pathHash: dir.pathHash, index: i, total, step: "store" });
    if (process.env.NODE_ENV !== "test") {
      console.log(`[pipeline] [store] ${name} (${i + 1}/${total})`);
    }

    // 3a. Scan
    const scanned = scanProject(dir.absPath);

    // 3b. Derive
    const derived = deriveProject(scanned);

    // 3c. DB upsert (Project, Scan, Derived)
    const lastCommitDateStr = scanned.lastCommitDate;
    const lastTouchedAt = lastCommitDateStr ? new Date(lastCommitDateStr) : null;

    const project = await db.project.upsert({
      where: { pathHash: dir.pathHash },
      create: {
        name,
        pathHash: dir.pathHash,
        pathDisplay: dir.absPath,
        lastTouchedAt,
      },
      update: {
        name,
        pathDisplay: dir.absPath,
        lastTouchedAt,
      },
    });

    const rawJson = JSON.stringify(scanned);
    const newHash = hashRawJson(rawJson);

    // Build metaJson — extensible key-value pairs for UI/display
    const metaJson = JSON.stringify({
      description: scanned.description ?? null,
      languages: scanned.languages ?? null,
      files: scanned.files ?? null,
      cicd: scanned.cicd ?? null,
      deployment: scanned.deployment ?? null,
      todoCount: scanned.todoCount ?? 0,
      fixmeCount: scanned.fixmeCount ?? 0,
      stashCount: scanned.stashCount ?? 0,
      commitCount: scanned.commitCount ?? 0,
    });

    await db.scan.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        rawJson,
        rawJsonHash: newHash,
        metaJson,
        scannedAt: new Date(scannedAt),
      },
      update: {
        rawJson,
        rawJsonHash: newHash,
        metaJson,
        scannedAt: new Date(scannedAt),
      },
    });

    if (derived) {
      const derivedJsonStr = JSON.stringify({ tags: derived.tags });
      const scoreBreakdownStr = JSON.stringify(derived.scoreBreakdownJson);

      const isDirty = scanned.isDirty;
      const dirtyFileCount = (scanned.untrackedCount ?? 0) + (scanned.modifiedCount ?? 0) + (scanned.stagedCount ?? 0);
      const ahead = scanned.ahead ?? 0;
      const behind = scanned.behind ?? 0;
      const framework = null;
      const branchName = scanned.branch ?? null;
      const lastCommitDate = lastCommitDateStr ? new Date(lastCommitDateStr) : null;
      const locEstimate = scanned.locEstimate ?? 0;
      const locBk = scanned.locBreakdown ?? {};
      const locCode = locBk.code ?? 0;
      const locDocs = locBk.docs ?? 0;
      const locGenerated = locBk.generated ?? 0;
      const weekCommits = scanned.weekCommits ?? 0;
      const monthCommits = scanned.monthCommits ?? 0;
      const quarterCommits = scanned.quarterCommits ?? 0;

      await db.derived.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          statusAuto: derived.statusAuto,
          healthScoreAuto: derived.healthScoreAuto,
          hygieneScoreAuto: derived.hygieneScoreAuto,
          momentumScoreAuto: derived.momentumScoreAuto,
          scoreBreakdownJson: scoreBreakdownStr,
          derivedJson: derivedJsonStr,
          isDirty,
          dirtyFileCount,
          ahead,
          behind,
          framework,
          branchName,
          lastCommitDate,
          locEstimate,
          locCode,
          locDocs,
          locGenerated,
          weekCommits,
          monthCommits,
          quarterCommits,
        },
        update: {
          statusAuto: derived.statusAuto,
          healthScoreAuto: derived.healthScoreAuto,
          hygieneScoreAuto: derived.hygieneScoreAuto,
          momentumScoreAuto: derived.momentumScoreAuto,
          scoreBreakdownJson: scoreBreakdownStr,
          derivedJson: derivedJsonStr,
          isDirty,
          dirtyFileCount,
          ahead,
          behind,
          framework,
          branchName,
          lastCommitDate,
          locEstimate,
          locCode,
          locDocs,
          locGenerated,
          weekCommits,
          monthCommits,
          quarterCommits,
        },
      });
    }

    // 3d. GitHub fetch (part of fast scan — not gated behind LLM)
    let github: ProjectData["github"];

    if (ghAvailable) {
      const remoteUrl = scanned.remoteUrl as string | null;
      const ownerRepo = remoteUrl ? parseGitHubOwnerRepo(remoteUrl) : null;
      if (ownerRepo) {
        const ghData = await fetchGitHubDataAsync(ownerRepo);
        await db.gitHub.upsert({
          where: { projectId: project.id },
          create: {
            projectId: project.id,
            openIssues: ghData.openIssues,
            openPrs: ghData.openPrs,
            ciStatus: ghData.ciStatus,
            issuesJson: ghData.issuesJson,
            prsJson: ghData.prsJson,
            repoVisibility: ghData.repoVisibility,
            fetchedAt: new Date(),
          },
          update: {
            openIssues: ghData.openIssues,
            openPrs: ghData.openPrs,
            ciStatus: ghData.ciStatus,
            issuesJson: ghData.issuesJson,
            prsJson: ghData.prsJson,
            repoVisibility: ghData.repoVisibility,
            fetchedAt: new Date(),
          },
        });
        if (ghData.repoVisibility !== "not-on-github") {
          github = {
            openIssues: ghData.openIssues,
            openPrs: ghData.openPrs,
            ciStatus: ghData.ciStatus,
            repoVisibility: ghData.repoVisibility,
            topIssues: ghData.issuesJson ?? undefined,
            topPrs: ghData.prsJson ?? undefined,
          };
        }
      }
    }

    // 3e. Emit project_complete(store) → UI refetches
    await emit({
      type: "project_complete",
      name,
      pathHash: dir.pathHash,
      step: "store",
      detail: { status: derived?.statusAuto, healthScore: derived?.healthScoreAuto },
      lastCommitDate: lastCommitDateStr,
    });

    // Stash data for pass 2
    projectDataList.push({
      dir,
      projectId: project.id,
      name,
      scanned,
      derived: derived ? {
        statusAuto: derived.statusAuto,
        healthScoreAuto: derived.healthScoreAuto,
        hygieneScoreAuto: derived.hygieneScoreAuto,
        momentumScoreAuto: derived.momentumScoreAuto,
        tags: derived.tags,
      } : undefined,
      github,
    });
  }

  // Sort pass 2 by most-recently-active first (lastCommitDate from scan data)
  projectDataList.sort((a, b) => {
    const aDate = a.scanned.lastCommitDate as string | null;
    const bDate = b.scanned.lastCommitDate as string | null;
    if (!aDate && !bDate) return a.name.localeCompare(b.name);
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  if (signal?.aborted) {
    return { projectCount: projectDirs.length };
  }

  // ── Pass 2: LLM enrichment with bounded concurrency (most recent first) ──
  if (!llmProvider) {
    for (const pd of projectDataList) {
      llmSkipped++;
      projectLog.push({
        projectId: pd.projectId,
        name: pd.name,
        derived: pd.derived ? { statusAuto: pd.derived.statusAuto, healthScoreAuto: pd.derived.healthScoreAuto } : undefined,
        llmResult: "skipped",
      });
    }
  } else {
    const llmCandidates: ProjectData[] = [];
    const projectOrder = new Map(projectDataList.map((pd, index) => [pd.dir.pathHash, index]));

    for (const pd of projectDataList) {
      if (pd.derived) llmCandidates.push(pd);
      else {
        llmSkipped++;
        projectLog.push({
          projectId: pd.projectId,
          name: pd.name,
          derived: undefined,
          llmResult: "skipped",
        });
      }
    }

    if (process.env.NODE_ENV !== "test" && llmCandidates.length > 0) {
      console.log(`[pipeline] [${providerName}] concurrency=${config.llmConcurrency}`);
    }

    const runLlmForProject = async (pd: ProjectData, index: number) => {
      if (!pd.derived || signal?.aborted) return;

      await emit({ type: "project_start", name: pd.name, pathHash: pd.dir.pathHash, index, total, step: "llm", provider: providerName ?? undefined });
      const llmStartTime = Date.now();
      if (process.env.NODE_ENV !== "test") {
        console.log(`[pipeline] [${providerName}] ${pd.name} (${index + 1}/${total}) — enriching...`);
      }

      try {
        const existingLlm = await db.llm.findUnique({
          where: { projectId: pd.projectId },
          select: { summary: true, purpose: true },
        });
        const previousSummary = existingLlm?.summary ?? existingLlm?.purpose ?? undefined;

        const enrichment: LlmEnrichment = await llmProvider.enrich({
          name: pd.name,
          path: pd.dir.absPath,
          scan: pd.scanned,
          derived: {
            statusAuto: pd.derived.statusAuto,
            healthScoreAuto: pd.derived.healthScoreAuto,
            hygieneScoreAuto: pd.derived.hygieneScoreAuto,
            momentumScoreAuto: pd.derived.momentumScoreAuto,
            tags: pd.derived.tags,
          },
          github: pd.github,
          previousSummary,
        }, signal);

        if (signal?.aborted) return;

        await db.llm.upsert({
          where: { projectId: pd.projectId },
          create: {
            projectId: pd.projectId,
            summary: enrichment.summary,
            nextAction: enrichment.nextAction,
            llmStatus: enrichment.status,
            statusReason: enrichment.statusReason,
            tagsJson: JSON.stringify(enrichment.tags),
            insightsJson: JSON.stringify(enrichment.insights),
            framework: enrichment.framework,
            primaryLanguage: enrichment.primaryLanguage,
            llmError: null,
          },
          update: {
            summary: enrichment.summary,
            nextAction: enrichment.nextAction,
            llmStatus: enrichment.status,
            statusReason: enrichment.statusReason,
            tagsJson: JSON.stringify(enrichment.tags),
            insightsJson: JSON.stringify(enrichment.insights),
            framework: enrichment.framework,
            primaryLanguage: enrichment.primaryLanguage,
            llmError: null,
            generatedAt: new Date(),
          },
        });

        llmSucceeded++;
        const llmDurationMs = Date.now() - llmStartTime;
        if (process.env.NODE_ENV !== "test") {
          console.log(`[pipeline] [${providerName}] ${pd.name} — done (${(llmDurationMs / 1000).toFixed(1)}s) status=${enrichment.status}`);
        }
        await emit({
          type: "project_complete",
          name: pd.name,
          pathHash: pd.dir.pathHash,
          step: "llm",
          detail: { summary: enrichment.summary, durationMs: llmDurationMs },
          provider: providerName ?? undefined,
        });

        projectLog.push({
          projectId: pd.projectId,
          name: pd.name,
          derived: { statusAuto: pd.derived.statusAuto, healthScoreAuto: pd.derived.healthScoreAuto },
          llmResult: "succeeded",
        });
      } catch (err) {
        if (isAbortError(err, signal)) return;

        llmFailed++;
        llmFailedNames.push(pd.name);
        const message = err instanceof Error ? err.message : String(err);
        const llmDurationMs = Date.now() - llmStartTime;
        if (process.env.NODE_ENV !== "test") {
          console.error(`[pipeline] [${providerName}] ${pd.name} — FAILED (${(llmDurationMs / 1000).toFixed(1)}s): ${message}`);
        }
        await db.llm.upsert({
          where: { projectId: pd.projectId },
          create: { projectId: pd.projectId, llmError: message },
          update: { llmError: message },
        });
        await emit({ type: "project_error", name: pd.name, pathHash: pd.dir.pathHash, step: "llm", error: message, provider: providerName ?? undefined });

        projectLog.push({
          projectId: pd.projectId,
          name: pd.name,
          derived: { statusAuto: pd.derived.statusAuto, healthScoreAuto: pd.derived.healthScoreAuto },
          llmResult: "failed",
        });
      }
    };

    let nextCandidate = 0;
    const workerCount = Math.min(config.llmConcurrency, llmCandidates.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (!signal?.aborted) {
          const candidate = llmCandidates[nextCandidate++];
          if (!candidate) return;
          const index = projectOrder.get(candidate.dir.pathHash) ?? 0;
          await runLlmForProject(candidate, index);
        }
      }),
    );
  }

  // 4. Portfolio analysis (only after AI scan with LLM)
  if (llmProvider && llmSucceeded > 0 && !signal?.aborted) {
    await runPortfolioAnalysis(signal);
  }

  // 5. Log activity for each project
  for (const entry of projectLog) {
    await db.activity.create({
      data: {
        projectId: entry.projectId,
        type: llmProvider ? "scan+llm" : "scan",
        payloadJson: JSON.stringify({
          scannedAt,
          status: entry.derived?.statusAuto,
          healthScore: entry.derived?.healthScoreAuto,
          llmResult: entry.llmResult,
        }),
      },
    });
  }

  // 6. Emit done IMMEDIATELY — don't let notifications/cleanup delay it
  //    The UI needs this event to transition out of "active" state.
  if (signal?.aborted) {
    return { projectCount: projectDirs.length };
  }

  const durationMs = Date.now() - startTime;
  if (process.env.NODE_ENV !== "test") {
    const scanType = options?.skipLlm ? "Fast scan" : "AI scan";
    console.log(
      `[pipeline] ${scanType} complete in ${(durationMs / 1000).toFixed(1)}s — ` +
      `${projectDirs.length} projects` +
      (llmSkipped > 0 ? "" : `, LLM: ${llmSucceeded} ok / ${llmFailed} failed`) +
      (providerName ? ` (${providerName})` : ""),
    );
    if (llmFailedNames.length > 0) {
      console.log(`[pipeline] Failed projects: ${llmFailedNames.join(", ")}`);
    }
  }
  if (process.env.NODE_ENV !== "test") {
    console.log(`[pipeline] Emitting done event`);
  }
  await emit({
    type: "done",
    projectCount: projectDirs.length,
    llmSucceeded,
    llmFailed,
    llmFailedNames,
    llmSkipped,
    durationMs,
    provider: providerName ?? undefined,
  });

  // 7. Notifications are deprecated — in-app attention signals (What Now tab)
  //    and future menu bar badges replace system notifications.
  //    Cleanup old notification Activity records:
  if (process.env.NODE_ENV !== "test") {
    try {
      await db.activity.deleteMany({ where: { type: "notification" } });
    } catch {
      // Best-effort
    }
  }

  // 8. Cleanup: delete Activity records older than 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await db.activity.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });

  return { projectCount: projectDirs.length };
}
