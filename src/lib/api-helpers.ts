/* ------------------------------------------------------------------ */
/*  PATCH field coercion (framework-agnostic)                          */
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
 * Returns `{ data }` on success, or `{ error: string, status: number }` on failure.
 *
 * Framework-specific callers should convert the error into their response type.
 */
export function coercePatchBody(
  body: Record<string, unknown>,
  spec: FieldSpec,
):
  | { data: Record<string, string | null>; error?: never }
  | { data?: never; error: string; status: number } {
  const allowedFields = [...spec.stringFields, ...spec.jsonFields];
  const data: Record<string, string | null> = {};

  for (const field of allowedFields) {
    if (field in body) {
      try {
        data[field] = coerceField(field, body[field], spec.jsonFields);
      } catch (e) {
        return {
          error: (e as Error).message,
          status: 400,
        };
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return {
      error: `No valid fields. Allowed: ${allowedFields.join(", ")}`,
      status: 400,
    };
  }

  return { data };
}