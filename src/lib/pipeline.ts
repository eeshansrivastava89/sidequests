import { createHash } from "crypto";
import { config } from "./config";
import { db } from "./db";
import { getLlmProvider, type LlmEnrichment } from "./llm";
import { listProjectDirs, scanProject } from "./pipeline-native/scan";
import { deriveProject, type ScanProject as DeriveInput } from "./pipeline-native/derive";
import { fetchGitHubData, isGhAvailable, parseGitHubOwnerRepo } from "./pipeline-native/github";

/** Validate scan output shape. */
export function validateScanOutput(data: unknown): { scannedAt: string; projectCount: number; projects: Array<Record<string, unknown>> } {
  if (!data || typeof data !== "object") {
    throw new Error("scan: output is not an object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.scannedAt !== "string") {
    throw new Error("scan: missing or invalid 'scannedAt' (expected string)");
  }
  if (typeof obj.projectCount !== "number") {
    throw new Error("scan: missing or invalid 'projectCount' (expected number)");
  }
  if (!Array.isArray(obj.projects)) {
    throw new Error("scan: missing or invalid 'projects' (expected array)");
  }
  for (let i = 0; i < obj.projects.length; i++) {
    const p = obj.projects[i] as Record<string, unknown>;
    if (typeof p.name !== "string") throw new Error(`scan: projects[${i}] missing 'name'`);
    if (typeof p.path !== "string") throw new Error(`scan: projects[${i}] missing 'path'`);
    if (typeof p.pathHash !== "string") throw new Error(`scan: projects[${i}] missing 'pathHash'`);
  }
  return data as { scannedAt: string; projectCount: number; projects: Array<Record<string, unknown>> };
}

/** Validate derive output shape. */
export function validateDeriveOutput(data: unknown): { derivedAt: string; projects: Array<Record<string, unknown>> } {
  if (!data || typeof data !== "object") {
    throw new Error("derive: output is not an object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.derivedAt !== "string") {
    throw new Error("derive: missing or invalid 'derivedAt' (expected string)");
  }
  if (!Array.isArray(obj.projects)) {
    throw new Error("derive: missing or invalid 'projects' (expected array)");
  }
  for (let i = 0; i < obj.projects.length; i++) {
    const p = obj.projects[i] as Record<string, unknown>;
    if (typeof p.pathHash !== "string") throw new Error(`derive: projects[${i}] missing 'pathHash'`);
    if (typeof p.statusAuto !== "string") throw new Error(`derive: projects[${i}] missing 'statusAuto'`);
    if (typeof p.healthScoreAuto !== "number") throw new Error(`derive: projects[${i}] missing 'healthScoreAuto'`);
    if (typeof p.hygieneScoreAuto !== "number") throw new Error(`derive: projects[${i}] missing 'hygieneScoreAuto'`);
    if (typeof p.momentumScoreAuto !== "number") throw new Error(`derive: projects[${i}] missing 'momentumScoreAuto'`);
    if (typeof p.scoreBreakdownJson !== "object" || p.scoreBreakdownJson === null) throw new Error(`derive: projects[${i}] missing 'scoreBreakdownJson'`);
    if (!Array.isArray(p.tags)) throw new Error(`derive: projects[${i}] missing 'tags'`);
  }
  return data as { derivedAt: string; projects: Array<Record<string, unknown>> };
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
  emit: (event: PipelineEvent) => void = () => {},
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

  emit({ type: "enumerate_complete", projectCount: projectDirs.length, names: projectDirs.map((d) => d.name), pathHashes: projectDirs.map((d) => d.pathHash) });

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
    scanned: Record<string, unknown>;
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

    emit({ type: "project_start", name, pathHash: dir.pathHash, index: i, total, step: "store" });

    // 3a. Scan
    const scanned = scanProject(dir.absPath);

    // 3b. Derive
    const derived = deriveProject(scanned as unknown as DeriveInput);

    // 3c. DB upsert (Project, Scan, Derived)
    const lastCommitDateStr = scanned.lastCommitDate as string | null;
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

    await db.scan.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        rawJson,
        rawJsonHash: newHash,
        scannedAt: new Date(scannedAt),
      },
      update: {
        rawJson,
        rawJsonHash: newHash,
        scannedAt: new Date(scannedAt),
      },
    });

    if (derived) {
      const derivedJsonStr = JSON.stringify({ tags: derived.tags });
      const scoreBreakdownStr = JSON.stringify(derived.scoreBreakdownJson);

      const isDirty = (scanned.isDirty as boolean) ?? false;
      const dirtyFileCount = ((scanned.untrackedCount as number) ?? 0) + ((scanned.modifiedCount as number) ?? 0) + ((scanned.stagedCount as number) ?? 0);
      const ahead = (scanned.ahead as number) ?? 0;
      const behind = (scanned.behind as number) ?? 0;
      const framework = null;
      const branchName = (scanned.branch as string) ?? null;
      const lastCommitDate = lastCommitDateStr ? new Date(lastCommitDateStr) : null;
      const locEstimate = (scanned.locEstimate as number) ?? 0;
      const locBk = (scanned.locBreakdown as { code?: number; docs?: number; generated?: number }) ?? {};
      const locCode = locBk.code ?? 0;
      const locDocs = locBk.docs ?? 0;
      const locGenerated = locBk.generated ?? 0;

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
        },
      });
    }

    // 3d. GitHub fetch (part of fast scan — not gated behind LLM)
    let github: ProjectData["github"];

    if (ghAvailable) {
      const remoteUrl = scanned.remoteUrl as string | null;
      const ownerRepo = remoteUrl ? parseGitHubOwnerRepo(remoteUrl) : null;
      if (ownerRepo) {
        const ghData = fetchGitHubData(ownerRepo);
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
    emit({
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
      scanned: scanned as Record<string, unknown>,
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

      emit({ type: "project_start", name: pd.name, pathHash: pd.dir.pathHash, index, total, step: "llm", provider: providerName ?? undefined });
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
        emit({
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
        emit({ type: "project_error", name: pd.name, pathHash: pd.dir.pathHash, step: "llm", error: message, provider: providerName ?? undefined });

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

  // 4. Log activity for each project
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

  // 5. Cleanup: delete Activity records older than 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await db.activity.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });

  if (signal?.aborted) {
    return { projectCount: projectDirs.length };
  }

  const durationMs = Date.now() - startTime;
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[pipeline] Complete in ${(durationMs / 1000).toFixed(1)}s — ` +
      `${projectDirs.length} projects, ` +
      `LLM: ${llmSucceeded} ok / ${llmFailed} failed / ${llmSkipped} skipped` +
      (providerName ? ` (${providerName})` : ""),
    );
    if (llmFailedNames.length > 0) {
      console.log(`[pipeline] Failed projects: ${llmFailedNames.join(", ")}`);
    }
  }
  emit({
    type: "done",
    projectCount: projectDirs.length,
    llmSucceeded,
    llmFailed,
    llmFailedNames,
    llmSkipped,
    durationMs,
    provider: providerName ?? undefined,
  });

  return { projectCount: projectDirs.length };
}
