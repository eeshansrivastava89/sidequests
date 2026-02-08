import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandler, findProject, notFound, coercePatchBody } from "@/lib/api-helpers";

const FIELD_SPEC = {
  jsonFields: new Set(["evidenceJson", "outcomesJson"]),
  stringFields: new Set(["goal", "audience", "successMetrics", "nextAction", "publishTarget"]),
};

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const { id } = await params;

  const project = await findProject(id);
  if (!project) return notFound();

  const body = await request.json();
  const result = coercePatchBody(body, FIELD_SPEC);
  if (result.error) return result.error;
  const { data } = result;

  const metadata = await db.metadata.upsert({
    where: { projectId: id },
    create: { projectId: id, ...data },
    update: data,
  });

  await db.activity.create({
    data: {
      projectId: id,
      type: "metadata",
      payloadJson: JSON.stringify(data),
    },
  });

  return NextResponse.json({ ok: true, metadata });
});
