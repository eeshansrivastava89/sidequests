import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  Error wrapper                                                      */
/* ------------------------------------------------------------------ */

/** Format an unknown error into a consistent message string. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Detect SQLite "no such table" errors from Prisma/LibSQL. */
function isMissingTableError(error: unknown): boolean {
  const msg = errorMessage(error);
  return msg.includes("no such table") || msg.includes("SQLITE_ERROR");
}

/** Return a standard `{ ok: false, error }` 500 response. */
export function errorResponse(error: unknown, status = 500) {
  return NextResponse.json(
    { ok: false, error: errorMessage(error) },
    { status },
  );
}

/**
 * Wrap an async route handler with standard error handling.
 * Catches any thrown error and returns `{ ok: false, error }` with 500.
 * When `missingTableFallback` is provided, missing DB tables return that
 * response (200) instead of an error — used for routes that should degrade
 * gracefully on first run before any scan has populated the database.
 */
export function withErrorHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
  options?: { missingTableFallback?: () => NextResponse },
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (isMissingTableError(error)) {
        if (options?.missingTableFallback) {
          return options.missingTableFallback();
        }
        return NextResponse.json(
          {
            ok: false,
            error: "Database tables not found. Run `npm run setup` to initialize the database, then restart the dev server.",
          },
          { status: 503 },
        );
      }
      return errorResponse(error);
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Find-or-404                                                        */
/* ------------------------------------------------------------------ */

/**
 * Find a project by id or return null.
 * Callers should check for null and return `notFound()`.
 */
export async function findProject(id: string) {
  return db.project.findUnique({ where: { id } });
}

/** Standard 404 response for missing projects. */
export function notFound() {
  return NextResponse.json(
    { ok: false, error: "Project not found" },
    { status: 404 },
  );
}

/* ------------------------------------------------------------------ */
/*  PATCH field coercion                                               */
/* ------------------------------------------------------------------ */

interface FieldSpec {
  jsonFields: Set<string>;
  stringFields: Set<string>;
}

/** Coerce a single field value — stringify objects for JSON columns. */
function coerceField(
  field: string,
  value: unknown,
  jsonFields: Set<string>,
): string | null {
  if (value === null) return null;
  if (jsonFields.has(field)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  if (typeof value !== "string") {
    throw new Error(`Field "${field}" must be a string or null`);
  }
  return value;
}

/**
 * Parse and coerce a PATCH body against an allowed-fields spec.
 * Returns `{ data }` on success, or `{ error: NextResponse }` on failure.
 */
export function coercePatchBody(
  body: Record<string, unknown>,
  spec: FieldSpec,
): { data: Record<string, string | null>; error?: never }
  | { data?: never; error: NextResponse } {
  const allowedFields = [...spec.stringFields, ...spec.jsonFields];
  const data: Record<string, string | null> = {};

  for (const field of allowedFields) {
    if (field in body) {
      try {
        data[field] = coerceField(field, body[field], spec.jsonFields);
      } catch (e) {
        return {
          error: NextResponse.json(
            { ok: false, error: (e as Error).message },
            { status: 400 },
          ),
        };
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return {
      error: NextResponse.json(
        { ok: false, error: `No valid fields. Allowed: ${allowedFields.join(", ")}` },
        { status: 400 },
      ),
    };
  }

  return { data };
}

/* ------------------------------------------------------------------ */
/*  Safe JSON parse                                                    */
/* ------------------------------------------------------------------ */

/** Parse a JSON string, returning `fallback` on failure or null/undefined. */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
