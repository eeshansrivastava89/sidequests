import { describe, it, expect, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { createClient } from "@libsql/client";

// @ts-expect-error — .mjs import from TS test
import { bootstrapDb } from "../bootstrap-db.mjs";

const EXPECTED_TABLES = [
  "Project",
  "Scan",
  "Derived",
  "Llm",
  "Override",
  "Metadata",
  "Activity",
];

/** Expected columns per table (name → type). Derived from prisma/schema.prisma. */
const EXPECTED_COLUMNS: Record<string, Record<string, string>> = {
  Project: {
    id: "TEXT",
    name: "TEXT",
    pathHash: "TEXT",
    pathDisplay: "TEXT",
    pinned: "INTEGER",
    lastTouchedAt: "TEXT",
    createdAt: "TEXT",
    updatedAt: "TEXT",
    prunedAt: "TEXT",
  },
  Scan: {
    id: "TEXT",
    projectId: "TEXT",
    rawJson: "TEXT",
    rawJsonHash: "TEXT",
    scannedAt: "TEXT",
  },
  Derived: {
    id: "TEXT",
    projectId: "TEXT",
    statusAuto: "TEXT",
    healthScoreAuto: "INTEGER",
    hygieneScoreAuto: "INTEGER",
    momentumScoreAuto: "INTEGER",
    scoreBreakdownJson: "TEXT",
    derivedJson: "TEXT",
    isDirty: "INTEGER",
    ahead: "INTEGER",
    behind: "INTEGER",
    framework: "TEXT",
    branchName: "TEXT",
    lastCommitDate: "TEXT",
    locEstimate: "INTEGER",
  },
  Llm: {
    id: "TEXT",
    projectId: "TEXT",
    purpose: "TEXT",
    tagsJson: "TEXT",
    notableFeaturesJson: "TEXT",
    recommendationsJson: "TEXT",
    pitch: "TEXT",
    aiInsightJson: "TEXT",
    aiInsightGeneratedAt: "TEXT",
    generatedAt: "TEXT",
  },
  Override: {
    id: "TEXT",
    projectId: "TEXT",
    statusOverride: "TEXT",
    purposeOverride: "TEXT",
    tagsOverride: "TEXT",
    notesOverride: "TEXT",
    updatedAt: "TEXT",
  },
  Metadata: {
    id: "TEXT",
    projectId: "TEXT",
    goal: "TEXT",
    audience: "TEXT",
    successMetrics: "TEXT",
    nextAction: "TEXT",
    publishTarget: "TEXT",
    evidenceJson: "TEXT",
    outcomesJson: "TEXT",
  },
  Activity: {
    id: "TEXT",
    projectId: "TEXT",
    type: "TEXT",
    payloadJson: "TEXT",
    createdAt: "TEXT",
  },
};

/** Expected unique indexes (index name → table) */
const EXPECTED_UNIQUE_INDEXES: Record<string, string> = {
  Project_pathHash_key: "Project",
  Scan_projectId_key: "Scan",
  Derived_projectId_key: "Derived",
  Llm_projectId_key: "Llm",
  Override_projectId_key: "Override",
  Metadata_projectId_key: "Metadata",
};

const EXPECTED_COMPOSITE_INDEX = "Activity_projectId_createdAt_idx";

/** Tables with FK to Project.id */
const TABLES_WITH_FK = ["Scan", "Derived", "Llm", "Override", "Metadata", "Activity"];

let tmpPath: string;

afterEach(() => {
  if (tmpPath && fs.existsSync(tmpPath)) {
    fs.unlinkSync(tmpPath);
  }
});

function makeTmpDb(): string {
  tmpPath = path.join(os.tmpdir(), `pd-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  return tmpPath;
}

describe("bootstrapDb — schema parity", () => {
  it("creates all 7 tables", async () => {
    const dbPath = makeTmpDb();
    await bootstrapDb(dbPath);

    const client = createClient({ url: `file:${dbPath}` });
    const result = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );
    const tableNames = result.rows.map((r) => r.name as string).sort();
    client.close();

    expect(tableNames).toEqual([...EXPECTED_TABLES].sort());
  });

  it("has correct columns per table", async () => {
    const dbPath = makeTmpDb();
    await bootstrapDb(dbPath);

    const client = createClient({ url: `file:${dbPath}` });

    for (const table of EXPECTED_TABLES) {
      const info = await client.execute(`PRAGMA table_info('${table}')`);
      const columns: Record<string, string> = {};
      for (const row of info.rows) {
        columns[row.name as string] = row.type as string;
      }
      expect(columns).toEqual(EXPECTED_COLUMNS[table]);
    }

    client.close();
  });

  it("creates all expected indexes", async () => {
    const dbPath = makeTmpDb();
    await bootstrapDb(dbPath);

    const client = createClient({ url: `file:${dbPath}` });
    const result = await client.execute(
      `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`
    );
    const indexes = Object.fromEntries(
      result.rows.map((r) => [r.name as string, r.tbl_name as string])
    );
    client.close();

    // 6 unique indexes
    for (const [idx, tbl] of Object.entries(EXPECTED_UNIQUE_INDEXES)) {
      expect(indexes[idx]).toBe(tbl);
    }
    // 1 composite index
    expect(indexes[EXPECTED_COMPOSITE_INDEX]).toBe("Activity");
  });

  it("sets FK constraints on child tables", async () => {
    const dbPath = makeTmpDb();
    await bootstrapDb(dbPath);

    const client = createClient({ url: `file:${dbPath}` });

    for (const table of TABLES_WITH_FK) {
      const fks = await client.execute(`PRAGMA foreign_key_list('${table}')`);
      const targets = fks.rows.map((r) => r.table as string);
      expect(targets).toContain("Project");
    }

    client.close();
  });

  it("is idempotent — calling twice does not throw", async () => {
    const dbPath = makeTmpDb();
    await bootstrapDb(dbPath);
    await expect(bootstrapDb(dbPath)).resolves.toBeUndefined();
  });
});
