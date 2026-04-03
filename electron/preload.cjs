const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("prayerTimesDesktop", {
  getLocalizationBundle: () => ipcRenderer.invoke("runtime:getLocalizationBundle"),
  getRuntimeAssetUrl: (relativePath) => ipcRenderer.invoke("runtime:getRuntimeAssetUrl", relativePath)
});
