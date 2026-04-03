const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function getProjectRoot() {
  return path.resolve(__dirname, "..");
}

function getEditableRootDir() {
  if (app.isPackaged) return path.dirname(app.getPath("exe"));
  return getProjectRoot();
}

function safeResolveRuntimePath(relativePath = "") {
  const runtimeRoot = path.resolve(getEditableRootDir());
  const cleaned = relativePath.replace(/^[/\\]+/, "");
  const resolved = path.resolve(runtimeRoot, cleaned);
  return resolved.startsWith(runtimeRoot) ? resolved : "";
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getLocalizationBundle() {
  const localizationDir = safeResolveRuntimePath("localization");
  if (!localizationDir || !fs.existsSync(localizationDir)) return null;

  const registry = readJson(path.join(localizationDir, "languages.json"));
  if (!registry?.languages?.length) return null;

  const messagesByFile = {};

  for (const language of registry.languages) {
    if (!language?.file) continue;
    const fileData = readJson(path.join(localizationDir, language.file));
    if (fileData) messagesByFile[language.file] = fileData;
  }

  return {
    ...registry,
    messagesByFile
  };
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 915,
    minWidth: 1360,
    minHeight: 915,
    autoHideMenuBar: true,
    backgroundColor: "#121212",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (app.isPackaged) {
    void window.loadFile(path.join(getProjectRoot(), "dist", "index.html"));
  } else {
    void window.loadURL("http://127.0.0.1:5174");
  }
}

ipcMain.handle("runtime:getLocalizationBundle", () => getLocalizationBundle());
ipcMain.handle("runtime:getRuntimeAssetUrl", (_event, relativePath) => {
  const resolved = safeResolveRuntimePath(relativePath);
  if (!resolved || !fs.existsSync(resolved)) return "";
  return pathToFileURL(resolved).href;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
