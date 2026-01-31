import { NextResponse } from "next/server";
import { runRefreshPipeline } from "@/lib/pipeline";

export async function POST() {
  try {
    const result = await runRefreshPipeline();
    return NextResponse.json({
      ok: true,
      projectCount: result.projectCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
