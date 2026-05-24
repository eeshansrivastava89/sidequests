import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { coercePatchBody, safeJsonParse, isMissingTableError, errorMessage } from "@/lib/api-helpers";

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

  it("returns error on wrong type for string field", () => {
    const result = coercePatchBody({ statusOverride: 123 }, OVERRIDE_SPEC);
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    if (result.error) {
      expect(result.status).toBe(400);
    }
  });

  it("returns error on empty body", () => {
    const result = coercePatchBody({}, OVERRIDE_SPEC);
    expect(result.error).toBeDefined();
    if (result.error) {
      expect(result.status).toBe(400);
    }
  });

  it("ignores unknown fields", () => {
    const result = coercePatchBody(
      { statusOverride: "active", unknownField: "val" },
      OVERRIDE_SPEC,
    );
    expect(result.data).toEqual({ statusOverride: "active" });
  });
});

describe("isMissingTableError", () => {
  it("detects no such table errors", () => {
    expect(isMissingTableError(new Error("SQLITE_ERROR: no such table: main.Project"))).toBe(true);
    expect(isMissingTableError(new Error("no such table: Scan"))).toBe(true);
    expect(isMissingTableError(new Error("connection refused"))).toBe(false);
  });
});

describe("errorMessage", () => {
  it("extracts message from Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(errorMessage("hello")).toBe("hello");
    expect(errorMessage(42)).toBe("42");
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