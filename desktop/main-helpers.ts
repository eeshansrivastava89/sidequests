import net from "net";

/** Allowlist of secret keys that can be managed via IPC. */
export const ALLOWED_SECRET_KEYS = new Set(["openrouterApiKey"]);

/** Check if a key is in the secret allowlist. */
export function isAllowedSecretKey(key: string): boolean {
  return ALLOWED_SECRET_KEYS.has(key);
}

/** Window configuration for BrowserWindow creation. */
export const WINDOW_CONFIG = {
  width: 1400,
  height: 900,
  minWidth: 800,
  minHeight: 600,
  title: "Projects Dashboard",
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
} as const;

/** Find an available port by binding to port 0. */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("Could not determine port"));
      }
    });
    srv.on("error", reject);
  });
}

/** Poll a URL until it responds with a non-5xx status. */
export function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server did not start within ${timeoutMs}ms`));
        return;
      }
      const protocol = url.startsWith("https") ? require("https") : require("http");
      const req = protocol.get(url, (res: { statusCode?: number }) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          setTimeout(check, 200);
        }
      });
      req.on("error", () => setTimeout(check, 200));
      req.end();
    };
    check();
  });
}

/** Returns true if navigation to the given URL should be blocked (cross-origin). */
export function shouldBlockNavigation(navigationUrl: string, serverUrl: string): boolean {
  const parsed = new URL(navigationUrl);
  return parsed.origin !== new URL(serverUrl).origin;
}

/** Auto-updater configuration. Exported for testability. */
export interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: string, handler: (...args: unknown[]) => void): void;
  checkForUpdates(): Promise<unknown>;
}

/**
 * Configure auto-updater settings and event handlers.
 * Returns early (no-op) in dev mode.
 */
export function setupAutoUpdater(
  updater: AutoUpdaterLike,
  isDev: boolean,
  showMessageBox: (opts: Record<string, unknown>) => Promise<{ response: number }>,
  quitAndInstall: () => void,
): void {
  if (isDev) return;

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;

  updater.on("update-available", (info: unknown) => {
    const version = (info as { version?: string })?.version ?? "unknown";
    showMessageBox({
      type: "info",
      title: "Update Available",
      message: `Version ${version} is available. Download now?`,
      buttons: ["Download", "Later"],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        (updater as unknown as { downloadUpdate(): void }).downloadUpdate();
      }
    });
  });

  updater.on("update-downloaded", () => {
    showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "Update downloaded. The app will restart to apply the update.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        quitAndInstall();
      }
    });
  });

  updater.on("error", (err: unknown) => {
    console.error("[auto-updater]", (err as Error).message);
  });

  setTimeout(() => {
    updater.checkForUpdates().catch((err: Error) => {
      console.error("[auto-updater] check failed:", err.message);
    });
  }, 5_000);
}
