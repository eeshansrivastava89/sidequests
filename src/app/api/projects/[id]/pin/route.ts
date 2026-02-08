import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandler, findProject, notFound } from "@/lib/api-helpers";

export const PATCH = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const { id } = await params;

  const project = await findProject(id);
  if (!project) return notFound();

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
});
