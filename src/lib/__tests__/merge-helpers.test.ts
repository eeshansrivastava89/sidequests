import { describe, it, expect, vi } from "vitest";
import { parseJson, sanitizePath } from "@/lib/merge";

vi.mock("@/lib/config", () => ({
  config: {
    sanitizePaths: true,
  },
}));

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

describe("sanitizePath", () => {
  it("truncates long paths to ~/parent/project when sanitizePaths is true", async () => {
    const { config } = await import("@/lib/config");
    (config as Record<string, unknown>).sanitizePaths = true;

    expect(sanitizePath("/Users/john/dev/my-project")).toBe("~/dev/my-project");
  });

  it("preserves short paths (2 segments or fewer)", async () => {
    const { config } = await import("@/lib/config");
    (config as Record<string, unknown>).sanitizePaths = true;

    expect(sanitizePath("dev/project")).toBe("dev/project");
  });

  it("returns path unchanged when sanitizePaths is false", async () => {
    const { config } = await import("@/lib/config");
    (config as Record<string, unknown>).sanitizePaths = false;

    const longPath = "/Users/john/dev/my-project";
    expect(sanitizePath(longPath)).toBe(longPath);
  });
});
