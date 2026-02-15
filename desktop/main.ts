import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ChildProcess, fork } from "child_process";
import path from "path";
import net from "net";
import { decryptSecretsFile, setSecret, deleteSecret, hasSecret, migrateSettingsSecrets } from "./secrets";
import { autoUpdater } from "electron-updater";

const isDev = !app.isPackaged;
const DEV_SERVER_URL = "http://localhost:3000";

// Allowlist of secret keys that can be managed via IPC
const ALLOWED_SECRET_KEYS = new Set(["openrouterApiKey"]);

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverUrl: string | null = null;

function findFreePort(): Promise<number> {
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

function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
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

async function startProductionServer(): Promise<string> {
  const port = await findFreePort();
  const serverPath = path.join(app.getAppPath(), ".next", "standalone", "server.js");
  const userDataPath = app.getPath("userData");
  const secrets = decryptSecretsFile(userDataPath);

  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      ...secrets,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      APP_DATA_DIR: userDataPath,
    },
    stdio: "pipe",
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[server] ${data.toString().trim()}`);
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

function createWindow(url: string) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "Projects Dashboard",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Block navigation to external URLs
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.origin !== new URL(url).origin) {
      event.preventDefault();
    }
  });

  // Block new window creation (e.g. target="_blank")
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC handlers for preload bridge
ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("app:getDataDir", () => app.getPath("userData"));

// IPC handlers for secret management (renderer → main → encrypted disk)
ipcMain.handle("secrets:set", (_event, key: string, value: string) => {
  if (!ALLOWED_SECRET_KEYS.has(key)) throw new Error(`Secret key not allowed: ${key}`);
  setSecret(app.getPath("userData"), key, value);
});
ipcMain.handle("secrets:delete", (_event, key: string) => {
  if (!ALLOWED_SECRET_KEYS.has(key)) throw new Error(`Secret key not allowed: ${key}`);
  deleteSecret(app.getPath("userData"), key);
});
ipcMain.handle("secrets:has", (_event, key: string) => {
  if (!ALLOWED_SECRET_KEYS.has(key)) return false;
  return hasSecret(app.getPath("userData"), key);
});

// Auto-update setup (production only)
function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    dialog.showMessageBox({
      type: "info",
      title: "Update Available",
      message: `Version ${info.version} is available. Download now?`,
      buttons: ["Download", "Later"],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on("update-downloaded", () => {
    dialog.showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "Update downloaded. The app will restart to apply the update.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("[auto-updater]", err.message);
  });

  // Check for updates after a short delay to avoid blocking startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("[auto-updater] check failed:", err.message);
    });
  }, 5_000);
}

// IPC handler for manual update check from renderer
ipcMain.handle("app:checkForUpdates", async () => {
  if (isDev) return { updateAvailable: false };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { updateAvailable: !!result?.updateInfo };
  } catch {
    return { updateAvailable: false };
  }
});

app.whenReady().then(async () => {
  // Set APP_DATA_DIR for the main process (used by app-paths.ts if imported here)
  process.env.APP_DATA_DIR = app.getPath("userData");

  // Migrate plaintext secrets from settings.json to encrypted storage
  migrateSettingsSecrets(app.getPath("userData"));

  let url: string;
  if (isDev) {
    url = DEV_SERVER_URL;
  } else {
    try {
      url = await startProductionServer();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dialog.showErrorBox(
        "Projects Dashboard - Startup Error",
        `Failed to start the application server.\n\n${message}\n\nThe application will now exit.`
      );
      app.quit();
      return;
    }
  }

  serverUrl = url;
  createWindow(url);
  setupAutoUpdater();
});

app.on("window-all-closed", () => {
  // Quit on all platforms — single-purpose dashboard app
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null && serverUrl) {
    createWindow(serverUrl);
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
