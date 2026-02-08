import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandler, findProject, notFound } from "@/lib/api-helpers";

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const { id } = await params;
  const body = await request.json();
  const tool: string = body.tool ?? "unknown";

  const project = await findProject(id);
  if (!project) return notFound();

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
});
