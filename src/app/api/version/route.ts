import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

let cache: { latest: string; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCurrentVersion(): string {
  const pkgPath = join(process.cwd(), "package.json");
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
      { signal: controller.signal }
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
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

export async function GET() {
  const current = getCurrentVersion();
  const latest = await fetchLatestVersion();

  const info: VersionInfo = {
    current,
    latest,
    updateAvailable: latest ? isNewer(latest, current) : false,
  };

  return NextResponse.json(info);
}
