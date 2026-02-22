/*
  Warnings:

  - You are about to drop the column `evidenceJson` on the `Metadata` table. All the data in the column will be lost.
  - You are about to drop the column `outcomesJson` on the `Metadata` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Llm" ADD COLUMN "framework" TEXT;
ALTER TABLE "Llm" ADD COLUMN "insightsJson" TEXT;
ALTER TABLE "Llm" ADD COLUMN "llmError" TEXT;
ALTER TABLE "Llm" ADD COLUMN "llmStatus" TEXT;
ALTER TABLE "Llm" ADD COLUMN "nextAction" TEXT;
ALTER TABLE "Llm" ADD COLUMN "primaryLanguage" TEXT;
ALTER TABLE "Llm" ADD COLUMN "risksJson" TEXT;
ALTER TABLE "Llm" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "Llm" ADD COLUMN "summary" TEXT;

-- CreateTable
CREATE TABLE "GitHub" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "openIssues" INTEGER NOT NULL DEFAULT 0,
    "openPrs" INTEGER NOT NULL DEFAULT 0,
    "ciStatus" TEXT NOT NULL DEFAULT 'none',
    "issuesJson" TEXT,
    "prsJson" TEXT,
    "repoVisibility" TEXT NOT NULL DEFAULT 'not-on-github',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GitHub_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "goal" TEXT,
    "audience" TEXT,
    "successMetrics" TEXT,
    "nextAction" TEXT,
    "publishTarget" TEXT,
    CONSTRAINT "Metadata_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Metadata" ("audience", "goal", "id", "nextAction", "projectId", "publishTarget", "successMetrics") SELECT "audience", "goal", "id", "nextAction", "projectId", "publishTarget", "successMetrics" FROM "Metadata";
DROP TABLE "Metadata";
ALTER TABLE "new_Metadata" RENAME TO "Metadata";
CREATE UNIQUE INDEX "Metadata_projectId_key" ON "Metadata"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GitHub_projectId_key" ON "GitHub"("projectId");
