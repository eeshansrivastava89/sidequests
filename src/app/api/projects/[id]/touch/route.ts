import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const tool: string = body.tool ?? "unknown";

    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    await db.project.update({
      where: { id },
      data: { lastTouchedAt: new Date() },
    });

    await db.activity.create({
      data: {
        projectId: id,
        type: "opened",
        payloadJson: JSON.stringify({ tool }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
