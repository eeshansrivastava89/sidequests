import { NextResponse } from "next/server";
import { mergeAllProjects } from "@/lib/merge";
import { db } from "@/lib/db";
import { withErrorHandler } from "@/lib/api-helpers";

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  const [projects, lastScan] = await Promise.all([
    mergeAllProjects(),
    db.scan.findFirst({ orderBy: { scannedAt: "desc" }, select: { scannedAt: true } }),
  ]);
  const lastRefreshedAt = lastScan?.scannedAt?.toISOString() ?? null;
  return NextResponse.json({ ok: true, projects, lastRefreshedAt });
});
