#!/usr/bin/env node

/**
 * Runtime DB schema bootstrap using raw SQL.
 * Uses @libsql/client to run CREATE TABLE IF NOT EXISTS for all 8 Prisma models.
 * Idempotent — safe to run every launch.
 */

import { createClient } from "@libsql/client";

const SCHEMA_SQL = [
  // 1. Project — no FK deps
  `CREATE TABLE IF NOT EXISTS "Project" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "name"          TEXT NOT NULL,
    "pathHash"      TEXT NOT NULL,
    "pathDisplay"   TEXT NOT NULL,
    "pinned"        INTEGER NOT NULL DEFAULT 0,
    "lastTouchedAt" TEXT,
    "createdAt"     TEXT NOT NULL DEFAULT (datetime('now')),
    "updatedAt"     TEXT NOT NULL DEFAULT (datetime('now')),
    "prunedAt"      TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Project_pathHash_key" ON "Project"("pathHash")`,

  // 2. Scan
  `CREATE TABLE IF NOT EXISTS "Scan" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "projectId"   TEXT NOT NULL,
    "rawJson"     TEXT NOT NULL,
    "rawJsonHash" TEXT,
    "scannedAt"   TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "Scan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Scan_projectId_key" ON "Scan"("projectId")`,

  // 3. Derived
  `CREATE TABLE IF NOT EXISTS "Derived" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "projectId"          TEXT NOT NULL,
    "statusAuto"         TEXT NOT NULL,
    "healthScoreAuto"    INTEGER NOT NULL,
    "hygieneScoreAuto"   INTEGER NOT NULL DEFAULT 0,
    "momentumScoreAuto"  INTEGER NOT NULL DEFAULT 0,
    "scoreBreakdownJson" TEXT NOT NULL DEFAULT '{}',
    "derivedJson"        TEXT NOT NULL,
    "isDirty"            INTEGER NOT NULL DEFAULT 0,
    "ahead"              INTEGER NOT NULL DEFAULT 0,
    "behind"             INTEGER NOT NULL DEFAULT 0,
    "framework"          TEXT,
    "branchName"         TEXT,
    "lastCommitDate"     TEXT,
    "locEstimate"        INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Derived_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Derived_projectId_key" ON "Derived"("projectId")`,

  // 4. Llm
  `CREATE TABLE IF NOT EXISTS "Llm" (
    "id"                     TEXT NOT NULL PRIMARY KEY,
    "projectId"              TEXT NOT NULL,
    "summary"                TEXT,
    "nextAction"             TEXT,
    "llmStatus"              TEXT,
    "statusReason"           TEXT,
    "risksJson"              TEXT,
    "tagsJson"               TEXT,
    "recommendationsJson"    TEXT,
    "purpose"                TEXT,
    "notableFeaturesJson"    TEXT,
    "pitch"                  TEXT,
    "aiInsightJson"          TEXT,
    "aiInsightGeneratedAt"   TEXT,
    "generatedAt"            TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "Llm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Llm_projectId_key" ON "Llm"("projectId")`,

  // 5. Override
  `CREATE TABLE IF NOT EXISTS "Override" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "projectId"       TEXT NOT NULL,
    "statusOverride"  TEXT,
    "purposeOverride" TEXT,
    "tagsOverride"    TEXT,
    "notesOverride"   TEXT,
    "updatedAt"       TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "Override_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Override_projectId_key" ON "Override"("projectId")`,

  // 6. Metadata
  `CREATE TABLE IF NOT EXISTS "Metadata" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "projectId"      TEXT NOT NULL,
    "goal"           TEXT,
    "audience"       TEXT,
    "successMetrics" TEXT,
    "nextAction"     TEXT,
    "publishTarget"  TEXT,
    CONSTRAINT "Metadata_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Metadata_projectId_key" ON "Metadata"("projectId")`,

  // 7. Activity
  `CREATE TABLE IF NOT EXISTS "Activity" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "projectId"   TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "payloadJson" TEXT,
    "createdAt"   TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Activity_projectId_createdAt_idx" ON "Activity"("projectId", "createdAt")`,

  // 8. GitHub
  `CREATE TABLE IF NOT EXISTS "GitHub" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "projectId"      TEXT NOT NULL,
    "openIssues"     INTEGER NOT NULL DEFAULT 0,
    "openPrs"        INTEGER NOT NULL DEFAULT 0,
    "ciStatus"       TEXT NOT NULL DEFAULT 'none',
    "issuesJson"     TEXT,
    "prsJson"        TEXT,
    "repoVisibility" TEXT NOT NULL DEFAULT 'not-on-github',
    "fetchedAt"      TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "GitHub_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GitHub_projectId_key" ON "GitHub"("projectId")`,
];

/**
 * Additive migrations: ALTER TABLE statements to add new columns to existing tables.
 * Each entry is idempotent — "IF NOT EXISTS" is not supported by SQLite ALTER TABLE,
 * so we catch errors for columns that already exist.
 */
const MIGRATIONS = [
  // Phase 53W: new Llm columns
  `ALTER TABLE "Llm" ADD COLUMN "summary" TEXT`,
  `ALTER TABLE "Llm" ADD COLUMN "nextAction" TEXT`,
  `ALTER TABLE "Llm" ADD COLUMN "llmStatus" TEXT`,
  `ALTER TABLE "Llm" ADD COLUMN "statusReason" TEXT`,
  `ALTER TABLE "Llm" ADD COLUMN "risksJson" TEXT`,
];

/**
 * Bootstrap the database schema at the given path.
 * @param {string} dbPath — absolute path to the SQLite file
 */
export async function bootstrapDb(dbPath) {
  const client = createClient({ url: `file:${dbPath}` });

  for (const sql of SCHEMA_SQL) {
    await client.execute(sql);
  }

  // Run additive migrations (ignore "duplicate column" errors)
  for (const sql of MIGRATIONS) {
    try {
      await client.execute(sql);
    } catch (err) {
      if (!String(err).includes("duplicate column")) throw err;
    }
  }

  client.close();
}
