-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Derived" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "statusAuto" TEXT NOT NULL,
    "healthScoreAuto" INTEGER NOT NULL,
    "hygieneScoreAuto" INTEGER NOT NULL DEFAULT 0,
    "momentumScoreAuto" INTEGER NOT NULL DEFAULT 0,
    "scoreBreakdownJson" TEXT NOT NULL DEFAULT '{}',
    "derivedJson" TEXT NOT NULL,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "dirtyFileCount" INTEGER NOT NULL DEFAULT 0,
    "ahead" INTEGER NOT NULL DEFAULT 0,
    "behind" INTEGER NOT NULL DEFAULT 0,
    "framework" TEXT,
    "branchName" TEXT,
    "lastCommitDate" DATETIME,
    "locEstimate" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Derived_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Derived" ("ahead", "behind", "branchName", "derivedJson", "framework", "healthScoreAuto", "hygieneScoreAuto", "id", "isDirty", "lastCommitDate", "locEstimate", "momentumScoreAuto", "projectId", "scoreBreakdownJson", "statusAuto") SELECT "ahead", "behind", "branchName", "derivedJson", "framework", "healthScoreAuto", "hygieneScoreAuto", "id", "isDirty", "lastCommitDate", "locEstimate", "momentumScoreAuto", "projectId", "scoreBreakdownJson", "statusAuto" FROM "Derived";
DROP TABLE "Derived";
ALTER TABLE "new_Derived" RENAME TO "Derived";
CREATE UNIQUE INDEX "Derived_projectId_key" ON "Derived"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
