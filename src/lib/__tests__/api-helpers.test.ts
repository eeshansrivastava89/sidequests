import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { coercePatchBody, safeJsonParse, withErrorHandler } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

const OVERRIDE_SPEC = {
  jsonFields: new Set(["tagsOverride"]),
  stringFields: new Set(["statusOverride", "purposeOverride", "notesOverride"]),
};

describe("coercePatchBody", () => {
  it("accepts a valid string field", () => {
    const result = coercePatchBody({ statusOverride: "paused" }, OVERRIDE_SPEC);
    expect(result.data).toEqual({ statusOverride: "paused" });
    expect(result.error).toBeUndefined();
  });

  it("accepts null for a field", () => {
    const result = coercePatchBody({ statusOverride: null }, OVERRIDE_SPEC);
    expect(result.data).toEqual({ statusOverride: null });
  });

  it("stringifies a JSON object for a JSON field", () => {
    const result = coercePatchBody({ tagsOverride: ["a", "b"] }, OVERRIDE_SPEC);
    expect(result.data).toEqual({ tagsOverride: JSON.stringify(["a", "b"]) });
  });

  it("passes through a string for a JSON field", () => {
    const result = coercePatchBody({ tagsOverride: '["a"]' }, OVERRIDE_SPEC);
    expect(result.data).toEqual({ tagsOverride: '["a"]' });
  });

  it("returns 400 on wrong type for string field", () => {
    const result = coercePatchBody({ statusOverride: 123 }, OVERRIDE_SPEC);
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it("returns 400 on empty body", () => {
    const result = coercePatchBody({}, OVERRIDE_SPEC);
    expect(result.error).toBeDefined();
  });

  it("ignores unknown fields", () => {
    const result = coercePatchBody(
      { statusOverride: "active", unknownField: "val" },
      OVERRIDE_SPEC,
    );
    expect(result.data).toEqual({ statusOverride: "active" });
  });
});

describe("withErrorHandler", () => {
  it("passes through a successful response", async () => {
    const handler = withErrorHandler(async () =>
      NextResponse.json({ ok: true }),
    );
    const res = await handler();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("catches thrown error and returns 500", async () => {
    const handler = withErrorHandler(async () => {
      throw new Error("boom");
    });
    const res = await handler();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("boom");
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}', null)).toEqual({ a: 1 });
  });

  it("returns fallback for null", () => {
    expect(safeJsonParse(null, "default")).toBe("default");
  });

  it("returns fallback for undefined", () => {
    expect(safeJsonParse(undefined, [])).toEqual([]);
  });

  it("returns fallback for invalid JSON", () => {
    expect(safeJsonParse("{bad", 42)).toBe(42);
  });
});
