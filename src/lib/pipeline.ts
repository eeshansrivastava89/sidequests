import { execFile, spawn } from "child_process";
import path from "path";
import { promisify } from "util";
import { config } from "./config";
import { db } from "./db";
import { getLlmProvider, type LlmEnrichment } from "./llm";

const execFileAsync = promisify(execFile);

const PIPELINE_DIR = path.resolve(process.cwd(), "pipeline");

interface ScanOutput {
  scannedAt: string;
  projectCount: number;
  projects: Array<{
    name: string;
    path: string;
    pathHash: string;
    [key: string]: unknown;
  }>;
}

interface DeriveOutput {
  derivedAt: string;
  projects: Array<{
    pathHash: string;
    statusAuto: string;
    healthScoreAuto: number;
    tags: string[];
  }>;
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

async function runPython(script: string, args: string[], stdin?: string): Promise<string> {
  const scriptPath = path.join(PIPELINE_DIR, script);

  if (stdin) {
    return new Promise((resolve, reject) => {
      const proc = spawn("python3", [scriptPath, ...args]);
      let stdout = "";
      let stderr = "";
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill();
        reject(new Error(`${script} timed out after 30s`));
      }, 30_000);

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (killed) return;
        if (code === 0) resolve(stdout);
        else reject(new Error(`${script} exited ${code}: ${stderr}`));
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        if (!killed) reject(err);
      });
      proc.stdin.write(stdin);
      proc.stdin.end();
    });
  }

  const { stdout } = await execFileAsync("python3", [scriptPath, ...args], {
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

/**
 * Executes the full pipeline: scan → derive → optional LLM enrichment → store.
 * Calls `emit` with progress events for each step.
 */
export async function runRefreshPipeline(
  emit: (event: PipelineEvent) => void = () => {},
  signal?: AbortSignal
): Promise<{ projectCount: number }> {
  const startTime = Date.now();
  let llmSucceeded = 0;
  let llmFailed = 0;
  let llmSkipped = 0;

  // 1. Scan
  emit({ type: "scan_start" });
  const scanJson = await runPython(
    "scan.py",
    [config.devRoot, config.excludeDirs.join(",")]
  );
  const scanData: ScanOutput = JSON.parse(scanJson);
  emit({ type: "scan_complete", projectCount: scanData.projectCount });

  // 2. Derive
  emit({ type: "derive_start" });
  const deriveJson = await runPython("derive.py", [], scanJson);
  const deriveData: DeriveOutput = JSON.parse(deriveJson);
  emit({ type: "derive_complete" });

  const derivedByHash = new Map(
    deriveData.projects.map((d) => [d.pathHash, d])
  );

  // Soft-prune missing projects and restore returning ones
  const scannedHashes = new Set(scanData.projects.map((p) => p.pathHash));
  await db.project.updateMany({
    where: { pathHash: { notIn: [...scannedHashes] }, prunedAt: null },
    data: { prunedAt: new Date() },
  });
  await db.project.updateMany({
    where: { pathHash: { in: [...scannedHashes] }, prunedAt: { not: null } },
    data: { prunedAt: null },
  });

  const llmProvider = getLlmProvider();
  const total = scanData.projects.length;

  // 3. Per-project: store + optional LLM
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;

    const scanned = scanData.projects[i];
    const derived = derivedByHash.get(scanned.pathHash);

    // Store step
    emit({ type: "project_start", name: scanned.name, index: i, total, step: "store" });

    const project = await db.project.upsert({
      where: { pathHash: scanned.pathHash },
      create: {
        name: scanned.name,
        pathHash: scanned.pathHash,
        pathDisplay: scanned.path,
        lastTouchedAt: new Date(),
      },
      update: {
        name: scanned.name,
        pathDisplay: scanned.path,
        lastTouchedAt: new Date(),
      },
    });

    const rawJson = JSON.stringify(scanned);
    await db.scan.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        rawJson,
        scannedAt: new Date(scanData.scannedAt),
      },
      update: {
        rawJson,
        scannedAt: new Date(scanData.scannedAt),
      },
    });

    if (derived) {
      const derivedJson = JSON.stringify({ tags: derived.tags });

      // Extract promoted columns from raw scan data
      const scanGit = scanned as Record<string, unknown>;
      const isDirty = (scanGit.isDirty as boolean) ?? false;
      const ahead = (scanGit.ahead as number) ?? 0;
      const behind = (scanGit.behind as number) ?? 0;
      const framework = (scanGit.framework as string) ?? null;
      const branchName = (scanGit.branch as string) ?? null;
      const lastCommitDateStr = scanGit.lastCommitDate as string | null;
      const lastCommitDate = lastCommitDateStr ? new Date(lastCommitDateStr) : null;
      const locEstimate = (scanGit.locEstimate as number) ?? 0;

      await db.derived.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          statusAuto: derived.statusAuto,
          healthScoreAuto: derived.healthScoreAuto,
          derivedJson,
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
          derivedJson,
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
      name: scanned.name,
      step: "store",
      detail: { status: derived?.statusAuto, healthScore: derived?.healthScoreAuto },
    });

    // LLM step
    let thisLlmResult: "success" | "failed" | "skipped" = "skipped";
    if (signal?.aborted) break;
    if (llmProvider && derived) {
      emit({ type: "project_start", name: scanned.name, index: i, total, step: "llm" });
      try {
        const enrichment: LlmEnrichment = await llmProvider.enrich({
          name: scanned.name,
          path: scanned.path,
          scan: scanned as Record<string, unknown>,
          derived: {
            statusAuto: derived.statusAuto,
            healthScoreAuto: derived.healthScoreAuto,
            tags: derived.tags,
          },
        });

        await db.llm.upsert({
          where: { projectId: project.id },
          create: {
            projectId: project.id,
            purpose: enrichment.purpose,
            tagsJson: JSON.stringify(enrichment.tags),
            notableFeaturesJson: JSON.stringify(enrichment.notableFeatures),
            recommendationsJson: JSON.stringify(enrichment.recommendations),
          },
          update: {
            purpose: enrichment.purpose,
            tagsJson: JSON.stringify(enrichment.tags),
            notableFeaturesJson: JSON.stringify(enrichment.notableFeatures),
            recommendationsJson: JSON.stringify(enrichment.recommendations),
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
            // Overwrite mode: use LLM values directly
            const data = Object.fromEntries(
              Object.entries(llmMeta).filter(([, v]) => v !== undefined)
            );
            await db.metadata.upsert({
              where: { projectId: project.id },
              create: { projectId: project.id, ...data },
              update: data,
            });
          } else {
            // Preserve mode: only fill empty fields
            const existing = await db.metadata.findUnique({ where: { projectId: project.id } });
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
                where: { projectId: project.id },
                create: { projectId: project.id, ...updates },
                update: updates,
              });
            }
          }
        }

        llmSucceeded++;
        thisLlmResult = "success";
        emit({
          type: "project_complete",
          name: scanned.name,
          step: "llm",
          detail: { purpose: enrichment.purpose },
        });
      } catch (err) {
        llmFailed++;
        thisLlmResult = "failed";
        const message = err instanceof Error ? err.message : String(err);
        console.error(`LLM enrichment failed for ${scanned.name}:`, err);
        emit({ type: "project_error", name: scanned.name, step: "llm", error: message });
      }
    } else if (!llmProvider) {
      llmSkipped++;
      thisLlmResult = "skipped";
    }

    // Log activity
    await db.activity.create({
      data: {
        projectId: project.id,
        type: llmProvider ? "scan+llm" : "scan",
        payloadJson: JSON.stringify({
          scannedAt: scanData.scannedAt,
          status: derived?.statusAuto,
          healthScore: derived?.healthScoreAuto,
          llmResult: thisLlmResult,
        }),
      },
    });
  }

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
