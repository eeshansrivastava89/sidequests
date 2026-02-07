import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    const updated = await db.project.update({
      where: { id },
      data: { pinned: !project.pinned },
    });

    await db.activity.create({
      data: {
        projectId: id,
        type: "pin",
        payloadJson: JSON.stringify({ pinned: updated.pinned }),
      },
    });

    return NextResponse.json({ ok: true, pinned: updated.pinned });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
