import { NextResponse } from "next/server";
import { mergeProjectView } from "@/lib/merge";
import { withErrorHandler } from "@/lib/api-helpers";

export const GET = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const { id } = await params;
  const project = await mergeProjectView(id);
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, project });
});
