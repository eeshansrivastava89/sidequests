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
    "snoozedUntil"  TEXT,
    "archivedNote"  TEXT,
    "createdAt"     TEXT NOT NULL DEFAULT (datetime('now')),
    "updatedAt"     TEXT NOT NULL DEFAULT (datetime('now')),
    "prunedAt"      TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Project_pathHash_key" ON "Project"("pathHash")`,
  `CREATE INDEX IF NOT EXISTS "Project_prunedAt_idx" ON "Project"("prunedAt")`,
  `CREATE INDEX IF NOT EXISTS "Project_lastTouchedAt_idx" ON "Project"("lastTouchedAt")`,

  // 2. Scan
  `CREATE TABLE IF NOT EXISTS "Scan" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "projectId"   TEXT NOT NULL,
    "rawJson"     TEXT NOT NULL,
    "rawJsonHash" TEXT,
    "metaJson"    TEXT,
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
    "dirtyFileCount"     INTEGER NOT NULL DEFAULT 0,
    "ahead"              INTEGER NOT NULL DEFAULT 0,
    "behind"             INTEGER NOT NULL DEFAULT 0,
    "framework"          TEXT,
    "branchName"         TEXT,
    "lastCommitDate"     TEXT,
    "locEstimate"        INTEGER NOT NULL DEFAULT 0,
    "locCode"            INTEGER NOT NULL DEFAULT 0,
    "locDocs"            INTEGER NOT NULL DEFAULT 0,
    "locGenerated"       INTEGER NOT NULL DEFAULT 0,
    "weekCommits"        INTEGER NOT NULL DEFAULT 0,
    "monthCommits"       INTEGER NOT NULL DEFAULT 0,
    "quarterCommits"    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Derived_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Derived_projectId_key" ON "Derived"("projectId")`,
  `CREATE INDEX IF NOT EXISTS "Derived_lastCommitDate_idx" ON "Derived"("lastCommitDate")`,

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
    "insightsJson"           TEXT,
    "framework"              TEXT,
    "primaryLanguage"        TEXT,
    "purpose"                TEXT,
    "llmError"               TEXT,
    "extrasJson"             TEXT,
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
  `CREATE INDEX IF NOT EXISTS "Activity_projectId_idx" ON "Activity"("projectId")`,

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

  // 9. WeeklyFocus
  `CREATE TABLE IF NOT EXISTS "WeeklyFocus" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "projectId"   TEXT NOT NULL,
    "goal"        TEXT NOT NULL,
    "completed"  INTEGER NOT NULL DEFAULT 0,
    "weekStart"   TEXT NOT NULL,
    "createdAt"   TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "WeeklyFocus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "WeeklyFocus_weekStart_idx" ON "WeeklyFocus"("weekStart")`,

  // 10. DismissedAlert
  `CREATE TABLE IF NOT EXISTS "DismissedAlert" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "projectId"   TEXT NOT NULL,
    "alertType"   TEXT NOT NULL,
    "dismissedAt" TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "DismissedAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DismissedAlert_projectId_alertType_key" ON "DismissedAlert"("projectId", "alertType")`,

  // 11. UserVisit
  `CREATE TABLE IF NOT EXISTS "UserVisit" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "key"          TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "updatedAt"    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserVisit_key_key" ON "UserVisit"("key")`,

  // 13. PortfolioAnalysis
  `CREATE TABLE IF NOT EXISTS "PortfolioAnalysis" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "resultJson"   TEXT NOT NULL,
    "generatedAt"  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
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
  // Phase 61W: LLM-sourced framework/language + consolidated insights
  `ALTER TABLE "Llm" ADD COLUMN "framework" TEXT`,
  `ALTER TABLE "Llm" ADD COLUMN "primaryLanguage" TEXT`,
  `ALTER TABLE "Llm" ADD COLUMN "insightsJson" TEXT`,
  // Observability: per-project LLM error tracking
  `ALTER TABLE "Llm" ADD COLUMN "llmError" TEXT`,
  // Extensible LLM output fields
  `ALTER TABLE "Llm" ADD COLUMN "extrasJson" TEXT`,
  // Extensible scan metadata fields
  `ALTER TABLE "Scan" ADD COLUMN "metaJson" TEXT`,
  // Dirty file count for uncommitted badge
  `ALTER TABLE "Derived" ADD COLUMN "dirtyFileCount" INTEGER NOT NULL DEFAULT 0`,
  // v0.3.13: LOC breakdown (locCode/locDocs/locGenerated)
  `ALTER TABLE "Derived" ADD COLUMN "locCode" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Derived" ADD COLUMN "locDocs" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Derived" ADD COLUMN "locGenerated" INTEGER NOT NULL DEFAULT 0`,
  // Phase 1: commit counts by date range
  `ALTER TABLE "Derived" ADD COLUMN "weekCommits" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Derived" ADD COLUMN "monthCommits" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Derived" ADD COLUMN "quarterCommits" INTEGER NOT NULL DEFAULT 0`,
  // Phase 1: snooze/archive columns on Project
  `ALTER TABLE "Project" ADD COLUMN "snoozedUntil" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "archivedNote" TEXT`,
];

/**
 * One-time data fixes keyed by name. Each runs at most once; a tracking table
 * records which fixes have already been applied.
 */
const DATA_FIXES = [
  {
    name: "61w-clear-polluted-lastTouchedAt",
    sql: `UPDATE "Project" SET "lastTouchedAt" = NULL WHERE "lastTouchedAt" IS NOT NULL`,
  },
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

  // One-time data fixes (tracked so they only run once)
  await client.execute(`CREATE TABLE IF NOT EXISTS "_DataFix" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" TEXT NOT NULL DEFAULT (datetime('now')))`);
  for (const fix of DATA_FIXES) {
    const row = await client.execute({ sql: `SELECT 1 FROM "_DataFix" WHERE "name" = ?`, args: [fix.name] });
    if (row.rows.length === 0) {
      await client.execute(fix.sql);
      await client.execute({ sql: `INSERT INTO "_DataFix" ("name") VALUES (?)`, args: [fix.name] });
    }
  }

  client.close();
}
