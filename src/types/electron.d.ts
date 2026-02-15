/** Type declarations for the Electron preload bridge (desktop/preload.ts). */
interface ElectronBridge {
  app: {
    getVersion: () => Promise<string>;
    getDataDir: () => Promise<string>;
  };
  secrets: {
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
    has: (key: string) => Promise<boolean>;
  };
}

interface Window {
  electron?: ElectronBridge;
}
