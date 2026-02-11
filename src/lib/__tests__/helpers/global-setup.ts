import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.resolve(process.cwd(), "test.db");

export function setup() {
  execSync(`npx prisma db push --force-reset --url "file:${TEST_DB_PATH}"`, {
    env: {
      ...process.env,
      // Consent for Prisma 7 AI agent safety check — this only affects the ephemeral test.db
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
    },
    stdio: "pipe",
  });
}

export function teardown() {
  try {
    fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // ignore if already deleted
  }
}
