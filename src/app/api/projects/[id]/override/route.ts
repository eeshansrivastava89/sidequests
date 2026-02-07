import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Fields stored as JSON strings — accept objects/arrays and stringify. */
const JSON_FIELDS = new Set(["tagsOverride"]);
/** Fields stored as plain strings. */
const STRING_FIELDS = new Set(["statusOverride", "purposeOverride", "notesOverride"]);
const ALLOWED_FIELDS = [...STRING_FIELDS, ...JSON_FIELDS];

function coerceField(field: string, value: unknown): string | null {
  if (value === null) return null;
  if (JSON_FIELDS.has(field)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  if (typeof value !== "string") {
    throw new Error(`Field "${field}" must be a string or null`);
  }
  return value;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify project exists
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();

    // Filter to allowed fields, coerce JSON fields
    const data: Record<string, string | null> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        try {
          data[field] = coerceField(field, body[field]);
        } catch (e) {
          return NextResponse.json(
            { ok: false, error: (e as Error).message },
            { status: 400 }
          );
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: `No valid fields. Allowed: ${ALLOWED_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }

    const override = await db.override.upsert({
      where: { projectId: id },
      create: { projectId: id, ...data },
      update: data,
    });

    // Log activity
    await db.activity.create({
      data: {
        projectId: id,
        type: "override",
        payloadJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ ok: true, override });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
