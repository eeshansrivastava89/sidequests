import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.resolve(process.cwd(), "test.db");
const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma", "migrations");

function buildMigrationSql(): string {
  const migrationDirs = fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => name !== "migration_lock.toml")
    .sort();

  return migrationDirs
    .map((dir) => path.join(MIGRATIONS_DIR, dir, "migration.sql"))
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n\n");
}

export function setup() {
  try {
    fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // ignore if file does not exist
  }

  execFileSync("sqlite3", [TEST_DB_PATH], {
    input: buildMigrationSql(),
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export function teardown() {
  try {
    fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // ignore if already deleted
  }
}
