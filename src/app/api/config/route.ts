import { NextResponse } from "next/server";
import { config } from "@/lib/config";

/** Expose client-safe feature flags. No secrets here. */
export async function GET() {
  return NextResponse.json({
    featureLlm: config.featureLlm,
    featureO1: config.featureO1,
  });
}
