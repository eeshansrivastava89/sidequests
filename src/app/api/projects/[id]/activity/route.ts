import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandler, findProject, notFound, safeJsonParse } from "@/lib/api-helpers";

export const GET = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const { id } = await params;

  const project = await findProject(id);
  if (!project) return notFound();

  const activities = await db.activity.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    ok: true,
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      payload: safeJsonParse(a.payloadJson, null),
      createdAt: a.createdAt.toISOString(),
    })),
  });
});
