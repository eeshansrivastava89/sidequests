import { NextResponse } from "next/server";
import { runRefreshPipeline } from "@/lib/pipeline";
import { withErrorHandler } from "@/lib/next-api-helpers";

export const POST = withErrorHandler(async (): Promise<NextResponse> => {
  const result = await runRefreshPipeline();
  return NextResponse.json({
    ok: true,
    projectCount: result.projectCount,
  });
});
