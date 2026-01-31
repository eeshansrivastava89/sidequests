import { execFile, spawn } from "child_process";
import path from "path";
import { promisify } from "util";
import { config } from "./config";
import { db } from "./db";

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

async function runPython(script: string, args: string[], stdin?: string): Promise<string> {
  const scriptPath = path.join(PIPELINE_DIR, script);

  if (stdin) {
    // Use spawn for stdin piping
    return new Promise((resolve, reject) => {
      const proc = spawn("python3", [scriptPath, ...args], {
        timeout: 30_000,
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`${script} exited ${code}: ${stderr}`));
      });
      proc.on("error", reject);
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
 * Executes the full deterministic pipeline: scan → derive → store.
 * Returns the number of projects processed.
 */
export async function runRefreshPipeline(): Promise<{ projectCount: number }> {
  // 1. Run scan
  const scanJson = await runPython(
    "scan.py",
    [config.devRoot, config.excludeDirs.join(",")]
  );
  const scanData: ScanOutput = JSON.parse(scanJson);

  // 2. Run derive (pipe scan output to derive.py via stdin)
  const deriveJson = await runPython("derive.py", [], scanJson);
  const deriveData: DeriveOutput = JSON.parse(deriveJson);

  // Build a lookup by pathHash for derived data
  const derivedByHash = new Map(
    deriveData.projects.map((d) => [d.pathHash, d])
  );

  // 3. Upsert into database
  for (const scanned of scanData.projects) {
    const derived = derivedByHash.get(scanned.pathHash);

    // Upsert Project
    const project = await db.project.upsert({
      where: { pathHash: scanned.pathHash },
      create: {
        name: scanned.name,
        pathHash: scanned.pathHash,
        pathDisplay: scanned.path,
      },
      update: {
        name: scanned.name,
        pathDisplay: scanned.path,
      },
    });

    // Upsert Scan
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

    // Upsert Derived
    if (derived) {
      const derivedJson = JSON.stringify({ tags: derived.tags });
      await db.derived.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          statusAuto: derived.statusAuto,
          healthScoreAuto: derived.healthScoreAuto,
          derivedJson,
        },
        update: {
          statusAuto: derived.statusAuto,
          healthScoreAuto: derived.healthScoreAuto,
          derivedJson,
        },
      });
    }

    // Log activity
    await db.activity.create({
      data: {
        projectId: project.id,
        type: "scan",
        payloadJson: JSON.stringify({
          scannedAt: scanData.scannedAt,
          status: derived?.statusAuto,
          healthScore: derived?.healthScoreAuto,
        }),
      },
    });
  }

  return { projectCount: scanData.projectCount };
}
