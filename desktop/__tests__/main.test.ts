import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ALLOWED_SECRET_KEYS,
  isAllowedSecretKey,
  WINDOW_CONFIG,
  findFreePort,
  shouldBlockNavigation,
  setupAutoUpdater,
  type AutoUpdaterLike,
} from "../../desktop/main-helpers";

// ── Mock net for deterministic findFreePort tests ───────────────────

vi.mock("net", () => {
  const mockServer = {
    listen: vi.fn((_port: number, cb: () => void) => cb()),
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

// ── Allowed secret keys ─────────────────────────────────────────────

describe("ALLOWED_SECRET_KEYS", () => {
  it("contains only openrouterApiKey", () => {
    expect(ALLOWED_SECRET_KEYS.size).toBe(1);
    expect(ALLOWED_SECRET_KEYS.has("openrouterApiKey")).toBe(true);
  });

  it("does not contain arbitrary keys", () => {
    expect(ALLOWED_SECRET_KEYS.has("password")).toBe(false);
    expect(ALLOWED_SECRET_KEYS.has("DATABASE_URL")).toBe(false);
    expect(ALLOWED_SECRET_KEYS.has("")).toBe(false);
  });
});

describe("isAllowedSecretKey", () => {
  it("returns true for allowed keys", () => {
    expect(isAllowedSecretKey("openrouterApiKey")).toBe(true);
  });

  it("returns false for disallowed keys", () => {
    expect(isAllowedSecretKey("password")).toBe(false);
    expect(isAllowedSecretKey("OPENROUTER_API_KEY")).toBe(false);
    expect(isAllowedSecretKey("")).toBe(false);
  });
});

// ── Window config ───────────────────────────────────────────────────

describe("WINDOW_CONFIG", () => {
  it("enforces contextIsolation: true", () => {
    expect(WINDOW_CONFIG.webPreferences.contextIsolation).toBe(true);
  });

  it("enforces nodeIntegration: false", () => {
    expect(WINDOW_CONFIG.webPreferences.nodeIntegration).toBe(false);
  });

  it("enforces sandbox: true", () => {
    expect(WINDOW_CONFIG.webPreferences.sandbox).toBe(true);
  });

  it("has expected dimensions", () => {
    expect(WINDOW_CONFIG.width).toBe(1400);
    expect(WINDOW_CONFIG.height).toBe(900);
    expect(WINDOW_CONFIG.minWidth).toBe(800);
    expect(WINDOW_CONFIG.minHeight).toBe(600);
  });

  it("has title set", () => {
    expect(WINDOW_CONFIG.title).toBe("Projects Dashboard");
  });
});

// ── findFreePort (mocked net) ───────────────────────────────────────

describe("findFreePort", () => {
  it("returns the port from the mocked server", async () => {
    const port = await findFreePort();
    expect(port).toBe(54321);
  });

  it("calls createServer and listens on port 0", async () => {
    const net = await import("net");
    const createServerFn = net.default?.createServer ?? net.createServer;
    await findFreePort();
    expect(createServerFn).toHaveBeenCalled();
    const mockServer = (net as unknown as { __mockServer: { listen: ReturnType<typeof vi.fn> } }).__mockServer;
    expect(mockServer.listen).toHaveBeenCalledWith(0, expect.any(Function));
  });

  it("closes the server after resolving", async () => {
    const net = await import("net");
    await findFreePort();
    const mockServer = (net as unknown as { __mockServer: { close: ReturnType<typeof vi.fn> } }).__mockServer;
    expect(mockServer.close).toHaveBeenCalledWith(expect.any(Function));
  });
});

// ── shouldBlockNavigation ───────────────────────────────────────────

describe("shouldBlockNavigation", () => {
  const serverUrl = "http://127.0.0.1:3000";

  it("blocks cross-origin navigation", () => {
    expect(shouldBlockNavigation("https://evil.com/phish", serverUrl)).toBe(true);
  });

  it("blocks different port on same host", () => {
    expect(shouldBlockNavigation("http://127.0.0.1:4000/other", serverUrl)).toBe(true);
  });

  it("allows same-origin navigation", () => {
    expect(shouldBlockNavigation("http://127.0.0.1:3000/settings", serverUrl)).toBe(false);
  });

  it("allows same-origin with path and query", () => {
    expect(shouldBlockNavigation("http://127.0.0.1:3000/api/projects?q=test", serverUrl)).toBe(false);
  });
});

// ── setupAutoUpdater ────────────────────────────────────────────────

describe("setupAutoUpdater", () => {
  let mockUpdater: AutoUpdaterLike & {
    downloadUpdate: ReturnType<typeof vi.fn>;
    handlers: Record<string, (...args: unknown[]) => void>;
  };
  let mockShowMessageBox: ReturnType<typeof vi.fn>;
  let mockQuitAndInstall: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdater = {
      autoDownload: true,
      autoInstallOnAppQuit: false,
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        mockUpdater.handlers[event] = handler;
      }),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      downloadUpdate: vi.fn(),
      handlers: {},
    };
    mockShowMessageBox = vi.fn().mockResolvedValue({ response: 1 }); // "Later" by default
    mockQuitAndInstall = vi.fn();
  });

  it("is a no-op in dev mode", () => {
    setupAutoUpdater(mockUpdater, true, mockShowMessageBox, mockQuitAndInstall);
    expect(mockUpdater.autoDownload).toBe(true); // unchanged
    expect(mockUpdater.on).not.toHaveBeenCalled();
  });

  it("sets autoDownload to false in production", () => {
    setupAutoUpdater(mockUpdater, false, mockShowMessageBox, mockQuitAndInstall);
    expect(mockUpdater.autoDownload).toBe(false);
  });

  it("sets autoInstallOnAppQuit to true in production", () => {
    setupAutoUpdater(mockUpdater, false, mockShowMessageBox, mockQuitAndInstall);
    expect(mockUpdater.autoInstallOnAppQuit).toBe(true);
  });

  it("registers update-available, update-downloaded, and error handlers", () => {
    setupAutoUpdater(mockUpdater, false, mockShowMessageBox, mockQuitAndInstall);
    expect(mockUpdater.on).toHaveBeenCalledWith("update-available", expect.any(Function));
    expect(mockUpdater.on).toHaveBeenCalledWith("update-downloaded", expect.any(Function));
    expect(mockUpdater.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("update-available handler calls downloadUpdate when user accepts", async () => {
    mockShowMessageBox.mockResolvedValue({ response: 0 }); // "Download"
    setupAutoUpdater(mockUpdater, false, mockShowMessageBox, mockQuitAndInstall);

    await mockUpdater.handlers["update-available"]({ version: "2.0.0" });

    expect(mockShowMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Update Available",
        message: expect.stringContaining("2.0.0"),
      })
    );
    expect(mockUpdater.downloadUpdate).toHaveBeenCalled();
  });

  it("update-available handler does NOT download when user declines", async () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 }); // "Later"
    setupAutoUpdater(mockUpdater, false, mockShowMessageBox, mockQuitAndInstall);

    await mockUpdater.handlers["update-available"]({ version: "2.0.0" });

    expect(mockUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  it("update-downloaded handler calls quitAndInstall when user accepts", async () => {
    mockShowMessageBox.mockResolvedValue({ response: 0 }); // "Restart Now"
    setupAutoUpdater(mockUpdater, false, mockShowMessageBox, mockQuitAndInstall);

    await mockUpdater.handlers["update-downloaded"]();

    expect(mockQuitAndInstall).toHaveBeenCalled();
  });

  it("update-downloaded handler does NOT restart when user declines", async () => {
    mockShowMessageBox.mockResolvedValue({ response: 1 }); // "Later"
    setupAutoUpdater(mockUpdater, false, mockShowMessageBox, mockQuitAndInstall);

    await mockUpdater.handlers["update-downloaded"]();

    expect(mockQuitAndInstall).not.toHaveBeenCalled();
  });
});

// ── IPC handler contracts (via isAllowedSecretKey guard) ────────────

describe("IPC handler contracts", () => {
  describe("secrets:set guard", () => {
    it("rejects disallowed keys", () => {
      expect(isAllowedSecretKey("maliciousKey")).toBe(false);
    });

    it("accepts allowed keys", () => {
      expect(isAllowedSecretKey("openrouterApiKey")).toBe(true);
    });
  });

  describe("secrets:delete guard", () => {
    it("rejects disallowed keys", () => {
      expect(isAllowedSecretKey("databaseUrl")).toBe(false);
    });
  });

  describe("secrets:has guard", () => {
    it("returns false for disallowed keys (guard prevents lookup)", () => {
      expect(isAllowedSecretKey("unknownKey")).toBe(false);
    });
  });
});
