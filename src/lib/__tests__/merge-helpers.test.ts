import { describe, it, expect } from "vitest";
import { parseJson } from "@/lib/merge";

describe("parseJson", () => {
  it("returns parsed object for valid JSON", () => {
    expect(parseJson('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("returns parsed array for valid JSON", () => {
    expect(parseJson('["x","y"]', [])).toEqual(["x", "y"]);
  });

  it("returns fallback for invalid JSON", () => {
    expect(parseJson("not json", "fallback")).toBe("fallback");
  });

  it("returns fallback for null input", () => {
    expect(parseJson(null, { default: true })).toEqual({ default: true });
  });

  it("returns fallback for undefined input", () => {
    expect(parseJson(undefined, [])).toEqual([]);
  });

  it("returns fallback for empty string", () => {
    expect(parseJson("", 42)).toBe(42);
  });
});
