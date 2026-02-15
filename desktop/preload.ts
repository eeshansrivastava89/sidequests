import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
    getDataDir: (): Promise<string> => ipcRenderer.invoke("app:getDataDir"),
  },
});
