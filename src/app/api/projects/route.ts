import { NextResponse } from "next/server";
import { mergeAllProjects } from "@/lib/merge";

export async function GET() {
  try {
    const projects = await mergeAllProjects();
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
