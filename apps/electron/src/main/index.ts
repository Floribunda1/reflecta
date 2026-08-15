import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { merge } from "lodash-es";
import "./services";
import { initializeDB } from "./db";
import { parseMigrationVersion, compareVersions } from "@reflecta/server";
import { registerAssetScheme, handleAssetProtocol } from "./assetProtocol";
import { APP_NAME, appLog, initializeLogging } from "./logger";
import { preloadScript, rendererHtml } from "./paths";
import { forwardDiagnosticEvents } from "./remote-diagnostics";
import { retrievalEmbeddingRunner } from "./retrievalEmbeddingRunner";
import { retrievalIndexCoordinator } from "./retrievalIndexCoordinator";
import { getRuntimeArg } from "./runtime-args";
import { installUpdateMenu, startAutomaticUpdateChecks } from "./updater";

// Register asset:// as a privileged scheme before app is ready
registerAssetScheme();
app.setName(APP_NAME);
const explicitUserDataDir = getRuntimeArg("reflecta-user-data-dir");
if (explicitUserDataDir) {
  app.setPath("userData", explicitUserDataDir);
}
initializeLogging();

// Telemetry seam: opt-in only, off by default. Setting this runtime arg
// forwards warn/error diagnostic events to the endpoint (redacted at the
// boundary). The product decision to collect telemetry stays in the future.
const telemetryUrl = getRuntimeArg("reflecta-telemetry-url");
if (telemetryUrl) {
  forwardDiagnosticEvents(telemetryUrl, { level: "warn" });
}

const createWindow = (option?: Electron.BrowserWindowConstructorOptions, route?: string) => {
  // Create the browser window.
  option = merge(
    {},
    {
      width: 900,
      height: 670,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: "#00000000",
      transparent: true,
      ...(process.platform === "darwin"
        ? ({
            titleBarStyle: "hiddenInset",
            trafficLightPosition: { x: 16, y: 16 },
            vibrancy: "under-window",
            visualEffectState: "active",
          } satisfies Electron.BrowserWindowConstructorOptions)
        : {}),
      webPreferences: {
        preload: preloadScript,
        sandbox: false,
      },
    } satisfies Electron.BrowserWindowConstructorOptions,
    option || {},
  );
  const mainWindow = new BrowserWindow(option);

  mainWindow.on("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const appUrl = is.dev ? (process.env.VITE_DEV_SERVER_URL ?? "") : `file://${rendererHtml}`;
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // HMR for renderer based on Vite.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.VITE_DEV_SERVER_URL) {
    const url = route
      ? `${process.env.VITE_DEV_SERVER_URL}${route}`
      : process.env.VITE_DEV_SERVER_URL;
    mainWindow.loadURL(url);
  } else {
    if (route) {
      mainWindow.loadFile(rendererHtml, { hash: route });
    } else {
      mainWindow.loadFile(rendererHtml);
    }
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// A7：数据版本推进到 v1.4.0 及以上时重建向量库（投影变更随数据迁移生效）
const VECTOR_REBUILD_THRESHOLD: [number, number, number] = [1, 4, 0];

function needsVectorRebuild(executed: string[]): boolean {
  return executed.some((name) => {
    try {
      return compareVersions(parseMigrationVersion(name), VECTOR_REBUILD_THRESHOLD) >= 0;
    } catch {
      return false;
    }
  });
}

app.whenReady().then(async () => {
  const { executed } = await initializeDB();
  if (needsVectorRebuild(executed)) {
    try {
      await retrievalIndexCoordinator.rebuild();
    } catch (error) {
      appLog.error("retrieval index rebuild failed on startup", error);
    }
  } else {
    retrievalIndexCoordinator.start();
  }
  app.once("before-quit", () => {
    retrievalIndexCoordinator.stop();
    retrievalEmbeddingRunner.stop();
  });

  nativeTheme.themeSource = "system";

  // Serve local assets via asset:// protocol
  handleAssetProtocol();

  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => appLog.debug("ipc.ping"));

  installUpdateMenu();
  createWindow();
  startAutomaticUpdateChecks();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
