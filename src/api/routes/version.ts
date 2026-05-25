import { Router } from "express";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gt as semverGt } from "semver";

interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

let cache: { latest: string; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCurrentVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(__dirname, "..", "..", "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

async function fetchLatestVersion(): Promise<string | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.latest;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      "https://registry.npmjs.org/@eeshans/sidequests/latest",
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const latest = data.version as string;
    cache = { latest, fetchedAt: Date.now() };
    return latest;
  } catch {
    return null;
  }
}

function isNewer(latest: string, current: string): boolean {
  return semverGt(latest, current);
}

export const versionRoute = Router();

// GET /api/version — current + latest version info
versionRoute.get("/", async (_req, res) => {
  const current = getCurrentVersion();
  const latest = await fetchLatestVersion();

  const info: VersionInfo = {
    current,
    latest,
    updateAvailable: latest ? isNewer(latest, current) : false,
  };

  res.json(info);
});