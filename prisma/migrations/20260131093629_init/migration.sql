-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pathHash" TEXT NOT NULL,
    "pathDisplay" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "rawJson" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Scan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Derived" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "statusAuto" TEXT NOT NULL,
    "healthScoreAuto" INTEGER NOT NULL,
    "derivedJson" TEXT NOT NULL,
    CONSTRAINT "Derived_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Llm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "purpose" TEXT,
    "tagsJson" TEXT,
    "notableFeaturesJson" TEXT,
    "recommendationsJson" TEXT,
    "takeawaysJson" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Llm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Override" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "statusOverride" TEXT,
    "purposeOverride" TEXT,
    "tagsOverride" TEXT,
    "notesOverride" TEXT,
    "manualJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Override_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "goal" TEXT,
    "audience" TEXT,
    "successMetrics" TEXT,
    "nextAction" TEXT,
    "publishTarget" TEXT,
    "evidenceJson" TEXT,
    "outcomesJson" TEXT,
    CONSTRAINT "Metadata_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_pathHash_key" ON "Project"("pathHash");

-- CreateIndex
CREATE UNIQUE INDEX "Scan_projectId_key" ON "Scan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Derived_projectId_key" ON "Derived"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Llm_projectId_key" ON "Llm"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Override_projectId_key" ON "Override"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Metadata_projectId_key" ON "Metadata"("projectId");
