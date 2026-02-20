import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// @ts-expect-error — .mjs import from TS test
import { parseArgs } from "../cli-helpers.mjs";

// ── parseArgs ─────────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("parses --port flag", () => {
    const result = parseArgs(["--port", "4000"]);
    expect(result.port).toBe(4000);
    expect(result.noOpen).toBe(false);
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it("parses --no-open flag", () => {
    const result = parseArgs(["--no-open"]);
    expect(result.noOpen).toBe(true);
  });

  it("parses --help flag", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
  });

  it("parses -h shorthand", () => {
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  it("parses --version flag", () => {
    expect(parseArgs(["--version"]).version).toBe(true);
  });

  it("parses -v shorthand", () => {
    expect(parseArgs(["-v"]).version).toBe(true);
  });

  it("returns defaults when no args given", () => {
    const result = parseArgs([]);
    expect(result).toEqual({ port: null, noOpen: false, help: false, version: false });
  });

  it("handles combined flags", () => {
    const result = parseArgs(["--port", "8080", "--no-open"]);
    expect(result.port).toBe(8080);
    expect(result.noOpen).toBe(true);
  });
});

// ── resolveDataDir ────────────────────────────────────────────────────

describe("resolveDataDir", () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    process.env = { ...originalEnv };
  });

  it("returns macOS path on darwin", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    // Re-import to pick up platform change
    const { resolveDataDir } = await import("../cli-helpers.mjs");
    const result = resolveDataDir();
    expect(result).toContain("Library/Application Support/ProjectsDashboard");
  });

  it("returns Windows path on win32", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    process.env.APPDATA = "/mock/appdata";
    const { resolveDataDir } = await import("../cli-helpers.mjs");
    const result = resolveDataDir();
    expect(result).toContain("ProjectsDashboard");
  });

  it("returns Linux XDG path on linux", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    delete process.env.XDG_DATA_HOME;
    const { resolveDataDir } = await import("../cli-helpers.mjs");
    const result = resolveDataDir();
    expect(result).toContain(".local/share/ProjectsDashboard");
  });

  it("respects XDG_DATA_HOME on linux", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    process.env.XDG_DATA_HOME = "/custom/data";
    const { resolveDataDir } = await import("../cli-helpers.mjs");
    const result = resolveDataDir();
    expect(result).toBe("/custom/data/ProjectsDashboard");
  });
});

// ── findFreePort (mocked net) ─────────────────────────────────────────

vi.mock("node:net", () => {
  const mockServer = {
    listen: vi.fn((_port: number, _host: string, cb: () => void) => cb()),
    address: vi.fn(() => ({ port: 54321 })),
    close: vi.fn((cb: () => void) => cb()),
    on: vi.fn(),
  };
  return {
    default: { createServer: vi.fn(() => mockServer) },
    createServer: vi.fn(() => mockServer),
    __mockServer: mockServer,
  };
});

describe("findFreePort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a numeric port", async () => {
    const { findFreePort } = await import("../cli-helpers.mjs");
    const port = await findFreePort();
    expect(typeof port).toBe("number");
    expect(port).toBe(54321);
  });

  it("passes preferred port to listen", async () => {
    const net = await import("node:net");
    const { findFreePort } = await import("../cli-helpers.mjs");
    await findFreePort(3000);
    const mockServer = (net as unknown as { __mockServer: { listen: ReturnType<typeof vi.fn> } }).__mockServer;
    expect(mockServer.listen).toHaveBeenCalledWith(3000, "127.0.0.1", expect.any(Function));
  });
});

// ── waitForServer (mocked http) ───────────────────────────────────────

let __httpGetHandler: ((...args: unknown[]) => unknown) | null = null;

vi.mock("node:http", () => ({
  default: {
    get: (...args: unknown[]) => __httpGetHandler?.(...args),
  },
  get: (...args: unknown[]) => __httpGetHandler?.(...args),
}));

describe("waitForServer", () => {
  beforeEach(() => {
    __httpGetHandler = null;
  });

  it("resolves when server returns status < 500", async () => {
    const mockReq = { on: vi.fn(), end: vi.fn() };
    __httpGetHandler = (_url: unknown, cb: unknown) => {
      (cb as (res: { statusCode: number }) => void)({ statusCode: 200 });
      return mockReq;
    };

    const { waitForServer } = await import("../cli-helpers.mjs");
    await expect(waitForServer("http://localhost:3000", 5000)).resolves.toBeUndefined();
  });

  it("rejects after timeout when server never responds", async () => {
    const mockReq = {
      on: vi.fn((_event: string, handler: () => void) => { handler(); }),
      end: vi.fn(),
    };
    __httpGetHandler = () => mockReq;

    const { waitForServer } = await import("../cli-helpers.mjs");
    await expect(waitForServer("http://localhost:3000", 500)).rejects.toThrow(
      /did not start within/
    );
  });
});
