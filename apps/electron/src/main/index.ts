import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { merge } from "lodash-es";
import "./services";
import { initializeDB } from "./db";
import { registerAssetScheme, handleAssetProtocol } from "./assetProtocol";
import { APP_NAME, appLog, initializeLogging } from "./logger";
import { preloadScript, rendererHtml } from "./paths";
import { startRetrievalIdleRebuild } from "./retrievalIdleRebuild";
import { getRuntimeArg } from "./runtime-args";

const FIND_IN_PAGE_CHANNEL = "window:find-in-page";
const STOP_FIND_IN_PAGE_CHANNEL = "window:stop-find-in-page";

// Register asset:// as a privileged scheme before app is ready
registerAssetScheme();
app.setName(APP_NAME);
const explicitUserDataDir = getRuntimeArg("reflecta-user-data-dir");
if (explicitUserDataDir) {
  app.setPath("userData", explicitUserDataDir);
}
initializeLogging();

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
app.whenReady().then(async () => {
  await initializeDB();
  const retrievalIdleRebuild = startRetrievalIdleRebuild();
  app.once("before-quit", () => retrievalIdleRebuild.stop());

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
  ipcMain.handle(
    FIND_IN_PAGE_CHANNEL,
    (event, text: unknown, options: Electron.FindInPageOptions = {}) => {
      if (typeof text !== "string" || text.length === 0) {
        event.sender.stopFindInPage("clearSelection");
        return 0;
      }
      const findOptions = typeof options === "object" && options ? options : {};

      return event.sender.findInPage(text, {
        forward: findOptions.forward !== false,
        findNext: findOptions.findNext === true,
        matchCase: findOptions.matchCase === true,
      });
    },
  );
  ipcMain.handle(STOP_FIND_IN_PAGE_CHANNEL, (event) => {
    event.sender.stopFindInPage("clearSelection");
  });

  createWindow();

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
