import path from "path";
import { vi } from "vitest";

const TEST_DB_PATH = path.resolve(process.cwd(), "test.db");

// Set DATABASE_URL before any db module imports
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

/**
 * Get a fresh Prisma client pointing at test.db.
 * Uses vi.resetModules() to bypass the globalThis singleton in db.ts.
 *
 * IMPORTANT: Callers must ensure the DB schema is current before first use.
 * Run `bootstrapDb(TEST_DB_PATH)` from bin/bootstrap-db.mjs to create/migrate tables.
 */
export async function getTestDb() {
  // Clear any cached singleton
  const g = globalThis as unknown as { prisma?: unknown };
  delete g.prisma;

  vi.resetModules();
  const { db } = await import("@/lib/db");
  return db;
}

/** Path to the test database file (for bootstrapDb). */
export { TEST_DB_PATH };

export async function cleanDb(db: Awaited<ReturnType<typeof getTestDb>>) {
  // Delete in dependency order (children first)
  await db.dismissedAlert.deleteMany();
  await db.weeklyFocus.deleteMany();
  await db.activity.deleteMany();
  await db.metadata.deleteMany();
  await db.override.deleteMany();
  await db.llm.deleteMany();
  await db.gitHub.deleteMany();
  await db.derived.deleteMany();
  await db.scan.deleteMany();
  await db.project.deleteMany();
  await db.userPreference.deleteMany();
  await db.userVisit.deleteMany();
}
