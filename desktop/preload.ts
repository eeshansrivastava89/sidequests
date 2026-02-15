import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
    getDataDir: (): Promise<string> => ipcRenderer.invoke("app:getDataDir"),
  },
  secrets: {
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke("secrets:set", key, value),
    delete: (key: string): Promise<void> => ipcRenderer.invoke("secrets:delete", key),
    has: (key: string): Promise<boolean> => ipcRenderer.invoke("secrets:has", key),
  },
});
