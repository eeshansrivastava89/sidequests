/*
  Warnings:

  - You are about to drop the column `takeawaysJson` on the `Llm` table. All the data in the column will be lost.
  - You are about to drop the column `manualJson` on the `Override` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Derived" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "statusAuto" TEXT NOT NULL,
    "healthScoreAuto" INTEGER NOT NULL,
    "derivedJson" TEXT NOT NULL,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "ahead" INTEGER NOT NULL DEFAULT 0,
    "behind" INTEGER NOT NULL DEFAULT 0,
    "framework" TEXT,
    "branchName" TEXT,
    "lastCommitDate" DATETIME,
    "locEstimate" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Derived_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Derived" ("derivedJson", "healthScoreAuto", "id", "projectId", "statusAuto") SELECT "derivedJson", "healthScoreAuto", "id", "projectId", "statusAuto" FROM "Derived";
DROP TABLE "Derived";
ALTER TABLE "new_Derived" RENAME TO "Derived";
CREATE UNIQUE INDEX "Derived_projectId_key" ON "Derived"("projectId");
CREATE TABLE "new_Llm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "purpose" TEXT,
    "tagsJson" TEXT,
    "notableFeaturesJson" TEXT,
    "recommendationsJson" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Llm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Llm" ("generatedAt", "id", "notableFeaturesJson", "projectId", "purpose", "recommendationsJson", "tagsJson") SELECT "generatedAt", "id", "notableFeaturesJson", "projectId", "purpose", "recommendationsJson", "tagsJson" FROM "Llm";
DROP TABLE "Llm";
ALTER TABLE "new_Llm" RENAME TO "Llm";
CREATE UNIQUE INDEX "Llm_projectId_key" ON "Llm"("projectId");
CREATE TABLE "new_Override" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "statusOverride" TEXT,
    "purposeOverride" TEXT,
    "tagsOverride" TEXT,
    "notesOverride" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Override_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Override" ("id", "notesOverride", "projectId", "purposeOverride", "statusOverride", "tagsOverride", "updatedAt") SELECT "id", "notesOverride", "projectId", "purposeOverride", "statusOverride", "tagsOverride", "updatedAt" FROM "Override";
DROP TABLE "Override";
ALTER TABLE "new_Override" RENAME TO "Override";
CREATE UNIQUE INDEX "Override_projectId_key" ON "Override"("projectId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pathHash" TEXT NOT NULL,
    "pathDisplay" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "lastTouchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "prunedAt" DATETIME
);
INSERT INTO "new_Project" ("createdAt", "id", "name", "pathDisplay", "pathHash", "prunedAt", "updatedAt") SELECT "createdAt", "id", "name", "pathDisplay", "pathHash", "prunedAt", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_pathHash_key" ON "Project"("pathHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Activity_projectId_createdAt_idx" ON "Activity"("projectId", "createdAt");
