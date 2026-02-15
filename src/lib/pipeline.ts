import { createHash } from "crypto";
import { config } from "./config";
import { db } from "./db";
import { getLlmProvider, type LlmEnrichment } from "./llm";
import { scanAll, type ScanOutput } from "./pipeline-native/scan";
import { deriveAll, type DeriveOutput, type ScanProject as DeriveInput } from "./pipeline-native/derive";

/** Validate scan output shape. */
export function validateScanOutput(data: unknown): ScanOutput {
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
  return data as ScanOutput;
}

/** Validate derive output shape. */
export function validateDeriveOutput(data: unknown): DeriveOutput {
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
  return data as DeriveOutput;
}

/** Events emitted during the refresh pipeline. */
export type PipelineEvent =
  | { type: "scan_start" }
  | { type: "scan_complete"; projectCount: number }
  | { type: "derive_start" }
  | { type: "derive_complete" }
  | { type: "project_start"; name: string; index: number; total: number; step: "store" | "llm" }
  | { type: "project_complete"; name: string; step: "store" | "llm"; detail?: Record<string, unknown> }
  | { type: "project_error"; name: string; step: string; error: string }
  | { type: "done"; projectCount: number; llmSucceeded: number; llmFailed: number; llmSkipped: number; durationMs: number };

/** Collected info from the store phase, passed to LLM phase. */
interface StoredProject {
  projectId: string;
  name: string;
  scanned: Record<string, unknown>;
  derived: { statusAuto: string; healthScoreAuto: number; hygieneScoreAuto: number; momentumScoreAuto: number; tags: string[] } | undefined;
  path: string;
}

function hashRawJson(rawJson: string): string {
  return createHash("sha256").update(rawJson).digest("hex");
}

/**
 * Executes the full pipeline: scan → derive → store (sequential) → optional LLM enrichment (parallel) → cleanup.
 * Calls `emit` with progress events for each step.
 */
export async function runRefreshPipeline(
  emit: (event: PipelineEvent) => void = () => {},
  signal?: AbortSignal,
  options?: { skipLlm?: boolean }
): Promise<{ projectCount: number }> {
  const startTime = Date.now();
  let llmSucceeded = 0;
  let llmFailed = 0;
  let llmSkipped = 0;

  // 1. Scan (TS-native — no Python dependency)
  emit({ type: "scan_start" });
  const scanData = scanAll(config.devRoot, config.excludeDirs);
  emit({ type: "scan_complete", projectCount: scanData.projectCount });

  // 2. Derive (TS-native — no Python dependency)
  emit({ type: "derive_start" });
  const deriveData = deriveAll({
    scannedAt: scanData.scannedAt,
    projects: scanData.projects as unknown as DeriveInput[],
  });
  emit({ type: "derive_complete" });

  const derivedByHash = new Map(
    deriveData.projects.map((d) => [d.pathHash, d])
  );

  // Soft-prune missing projects and restore returning ones
  const scannedHashes = new Set(scanData.projects.map((p) => p.pathHash as string));
  await db.project.updateMany({
    where: { pathHash: { notIn: [...scannedHashes] }, prunedAt: null },
    data: { prunedAt: new Date() },
  });
  await db.project.updateMany({
    where: { pathHash: { in: [...scannedHashes] }, prunedAt: { not: null } },
    data: { prunedAt: null },
  });

  const total = scanData.projects.length;

  // 3. Store phase (sequential) — upsert Project, Scan, Derived for each project
  const storedProjects: StoredProject[] = [];

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;

    const scanned = scanData.projects[i];
    const name = scanned.name as string;
    const projPath = scanned.path as string;
    const hash = scanned.pathHash as string;
    const derived = derivedByHash.get(hash);

    emit({ type: "project_start", name, index: i, total, step: "store" });

    const project = await db.project.upsert({
      where: { pathHash: hash },
      create: {
        name,
        pathHash: hash,
        pathDisplay: projPath,
        lastTouchedAt: new Date(),
      },
      update: {
        name,
        pathDisplay: projPath,
        lastTouchedAt: new Date(),
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
        scannedAt: new Date(scanData.scannedAt),
      },
      update: {
        rawJson,
        rawJsonHash: newHash,
        scannedAt: new Date(scanData.scannedAt),
      },
    });

    if (derived) {
      const derivedJsonStr = JSON.stringify({ tags: derived.tags });
      const scoreBreakdownStr = JSON.stringify(derived.scoreBreakdownJson);

      // Extract promoted columns from raw scan data
      const isDirty = (scanned.isDirty as boolean) ?? false;
      const ahead = (scanned.ahead as number) ?? 0;
      const behind = (scanned.behind as number) ?? 0;
      const framework = (scanned.framework as string) ?? null;
      const branchName = (scanned.branch as string) ?? null;
      const lastCommitDateStr = scanned.lastCommitDate as string | null;
      const lastCommitDate = lastCommitDateStr ? new Date(lastCommitDateStr) : null;
      const locEstimate = (scanned.locEstimate as number) ?? 0;

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
          ahead,
          behind,
          framework,
          branchName,
          lastCommitDate,
          locEstimate,
        },
        update: {
          statusAuto: derived.statusAuto,
          healthScoreAuto: derived.healthScoreAuto,
          hygieneScoreAuto: derived.hygieneScoreAuto,
          momentumScoreAuto: derived.momentumScoreAuto,
          scoreBreakdownJson: scoreBreakdownStr,
          derivedJson: derivedJsonStr,
          isDirty,
          ahead,
          behind,
          framework,
          branchName,
          lastCommitDate,
          locEstimate,
        },
      });
    }

    emit({
      type: "project_complete",
      name,
      step: "store",
      detail: { status: derived?.statusAuto, healthScore: derived?.healthScoreAuto },
    });

    storedProjects.push({
      projectId: project.id,
      name,
      scanned: scanned as Record<string, unknown>,
      derived: derived ? { statusAuto: derived.statusAuto, healthScoreAuto: derived.healthScoreAuto, hygieneScoreAuto: derived.hygieneScoreAuto, momentumScoreAuto: derived.momentumScoreAuto, tags: derived.tags } : undefined,
      path: projPath,
    });
  }

  // 4. LLM phase (batched parallel with concurrency limit)
  const llmProvider = options?.skipLlm ? null : getLlmProvider();

  if (llmProvider && !signal?.aborted) {
    // All projects with derived data are LLM candidates
    const llmCandidates = storedProjects.filter((sp) => sp.derived);
    const noDerivedCount = storedProjects.length - llmCandidates.length;
    llmSkipped += noDerivedCount;

    const concurrency = config.llmConcurrency;

    // Process LLM candidates in batches
    for (let batchStart = 0; batchStart < llmCandidates.length; batchStart += concurrency) {
      if (signal?.aborted) break;

      const batch = llmCandidates.slice(batchStart, batchStart + concurrency);

      const results = await Promise.allSettled(
        batch.map(async (sp) => {
          if (signal?.aborted) throw new Error("Aborted");

          const idx = storedProjects.indexOf(sp);
          emit({ type: "project_start", name: sp.name, index: idx, total, step: "llm" });

          const enrichment: LlmEnrichment = await llmProvider.enrich({
            name: sp.name,
            path: sp.path,
            scan: sp.scanned,
            derived: sp.derived!,
          });

          const aiInsightJson = enrichment.aiInsight ? JSON.stringify(enrichment.aiInsight) : null;

          await db.llm.upsert({
            where: { projectId: sp.projectId },
            create: {
              projectId: sp.projectId,
              purpose: enrichment.purpose,
              tagsJson: JSON.stringify(enrichment.tags),
              notableFeaturesJson: JSON.stringify(enrichment.notableFeatures),
              recommendationsJson: JSON.stringify(enrichment.recommendations),
              pitch: enrichment.pitch ?? null,
              aiInsightJson,
              aiInsightGeneratedAt: enrichment.aiInsight ? new Date() : null,
            },
            update: {
              purpose: enrichment.purpose,
              tagsJson: JSON.stringify(enrichment.tags),
              notableFeaturesJson: JSON.stringify(enrichment.notableFeatures),
              recommendationsJson: JSON.stringify(enrichment.recommendations),
              pitch: enrichment.pitch ?? null,
              aiInsightJson,
              aiInsightGeneratedAt: enrichment.aiInsight ? new Date() : undefined,
              generatedAt: new Date(),
            },
          });

          // Upsert metadata if LLM returned any metadata fields
          const hasMetadata = enrichment.goal || enrichment.audience || enrichment.successMetrics ||
            enrichment.nextAction || enrichment.publishTarget || enrichment.evidence || enrichment.outcomes;

          if (hasMetadata) {
            const llmMeta: Record<string, string | undefined> = {
              goal: enrichment.goal,
              audience: enrichment.audience,
              successMetrics: enrichment.successMetrics,
              nextAction: enrichment.nextAction,
              publishTarget: enrichment.publishTarget,
              evidenceJson: enrichment.evidence ? JSON.stringify(enrichment.evidence) : undefined,
              outcomesJson: enrichment.outcomes ? JSON.stringify(enrichment.outcomes) : undefined,
            };

            if (config.llmOverwriteMetadata) {
              const data = Object.fromEntries(
                Object.entries(llmMeta).filter(([, v]) => v !== undefined)
              );
              await db.metadata.upsert({
                where: { projectId: sp.projectId },
                create: { projectId: sp.projectId, ...data },
                update: data,
              });
            } else {
              const existing = await db.metadata.findUnique({ where: { projectId: sp.projectId } });
              const updates: Record<string, string> = {};
              for (const [key, val] of Object.entries(llmMeta)) {
                if (val === undefined) continue;
                const existingVal = existing?.[key as keyof typeof existing];
                if (!existingVal || (typeof existingVal === "string" && existingVal.trim() === "")) {
                  updates[key] = val;
                }
              }
              if (Object.keys(updates).length > 0) {
                await db.metadata.upsert({
                  where: { projectId: sp.projectId },
                  create: { projectId: sp.projectId, ...updates },
                  update: updates,
                });
              }
            }
          }

          return { sp, enrichment };
        })
      );

      // Process results
      for (const result of results) {
        if (result.status === "fulfilled") {
          llmSucceeded++;
          emit({
            type: "project_complete",
            name: result.value.sp.name,
            step: "llm",
            detail: { purpose: result.value.enrichment.purpose },
          });
        } else {
          llmFailed++;
          // Extract project name from the error context
          const batchIdx = results.indexOf(result);
          const sp = batch[batchIdx];
          const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.error(`LLM enrichment failed for ${sp.name}:`, result.reason);
          emit({ type: "project_error", name: sp.name, step: "llm", error: message });
        }
      }
    }
  } else if (!llmProvider) {
    llmSkipped += storedProjects.length;
  }

  // 5. Log activity for each project
  for (const sp of storedProjects) {
    if (signal?.aborted) break;
    const llmResult = !llmProvider ? "skipped" : (!sp.derived ? "skipped" : "attempted");

    await db.activity.create({
      data: {
        projectId: sp.projectId,
        type: llmProvider ? "scan+llm" : "scan",
        payloadJson: JSON.stringify({
          scannedAt: scanData.scannedAt,
          status: sp.derived?.statusAuto,
          healthScore: sp.derived?.healthScoreAuto,
          llmResult,
        }),
      },
    });
  }

  // 6. Cleanup: delete Activity records older than 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await db.activity.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });

  const durationMs = Date.now() - startTime;
  emit({
    type: "done",
    projectCount: scanData.projectCount,
    llmSucceeded,
    llmFailed,
    llmSkipped,
    durationMs,
  });

  return { projectCount: scanData.projectCount };
}
