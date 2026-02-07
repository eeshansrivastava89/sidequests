import { NextResponse } from "next/server";
import { mergeAllProjects } from "@/lib/merge";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [projects, lastScan] = await Promise.all([
      mergeAllProjects(),
      db.scan.findFirst({ orderBy: { scannedAt: "desc" }, select: { scannedAt: true } }),
    ]);
    const lastRefreshedAt = lastScan?.scannedAt?.toISOString() ?? null;
    return NextResponse.json({ ok: true, projects, lastRefreshedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
