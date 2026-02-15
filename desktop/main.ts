import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ChildProcess, fork } from "child_process";
import path from "path";
import { decryptSecretsFile, setSecret, deleteSecret, hasSecret, migrateSettingsSecrets } from "./secrets";
import { autoUpdater } from "electron-updater";
import { isAllowedSecretKey, WINDOW_CONFIG, findFreePort, waitForServer, shouldBlockNavigation, setupAutoUpdater } from "./main-helpers";

const isDev = !app.isPackaged;
const DEV_SERVER_URL = "http://localhost:3000";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverUrl: string | null = null;

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
    ...WINDOW_CONFIG,
    webPreferences: {
      ...WINDOW_CONFIG.webPreferences,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Block navigation to external URLs
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    if (shouldBlockNavigation(navigationUrl, url)) {
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
  if (!isAllowedSecretKey(key)) throw new Error(`Secret key not allowed: ${key}`);
  setSecret(app.getPath("userData"), key, value);
});
ipcMain.handle("secrets:delete", (_event, key: string) => {
  if (!isAllowedSecretKey(key)) throw new Error(`Secret key not allowed: ${key}`);
  deleteSecret(app.getPath("userData"), key);
});
ipcMain.handle("secrets:has", (_event, key: string) => {
  if (!isAllowedSecretKey(key)) return false;
  return hasSecret(app.getPath("userData"), key);
});

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
  setupAutoUpdater(
    autoUpdater,
    isDev,
    (opts) => dialog.showMessageBox(opts as unknown as Electron.MessageBoxOptions),
    () => autoUpdater.quitAndInstall(),
  );
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
