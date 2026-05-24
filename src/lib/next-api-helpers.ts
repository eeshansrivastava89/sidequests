import { NextResponse } from "next/server";
import { isMissingTableError, errorMessage } from "./api-helpers";

/* ------------------------------------------------------------------ */
/*  Next.js route error wrapper (uses framework-agnostic helpers)      */
/* ------------------------------------------------------------------ */

/**
 * Wrap an async Next.js route handler with standard error handling.
 * Uses isMissingTableError and errorMessage from the framework-agnostic
 * api-helpers module.
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
      return NextResponse.json(
        { ok: false, error: errorMessage(error) },
        { status: 500 },
      );
    }
  };
}

/** Standard 404 response for missing projects. */
export function notFound() {
  return NextResponse.json(
    { ok: false, error: "Project not found" },
    { status: 404 },
  );
}

/**
 * Convert a coercePatchBody error result to a NextResponse.
 * coercePatchBody returns { error: string, status: number } on failure.
 */
export function patchErrorToNextResponse(result: { error: string; status: number }): NextResponse {
  return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
}