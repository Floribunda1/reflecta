import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { merge } from "lodash-es";
import "./services";
import { initializeDB } from "./db";
import { registerAssetScheme, handleAssetProtocol } from "./assetProtocol";
import { APP_NAME, appLog, getEffectLoggingContext, initializeLogging, ipcLog } from "./logger";
import { preloadScript, rendererHtml } from "./paths";
import { retrievalEmbeddingRunner } from "./retrievalEmbeddingRunner";
import { retrievalIndexCoordinator } from "./retrievalIndexCoordinator";
import { getRuntimeArg } from "./runtime-args";
import { startAutomaticUpdateChecks } from "./updater";
import { readConfig, writeConfig } from "./config";
import { guardIpcHandlers, type HandlerLike } from "./rpc-guard";
import { appIpc } from "../ipc";
// 各域 IPC handler 模块：每域一个文件（对齐 ipc/contract/ 结构），错误构造器就近声明。
import { about } from "./ipc-handlers/about";
import { asset } from "./ipc-handlers/asset";
import { canvas } from "./ipc-handlers/canvas";
import { chat } from "./ipc-handlers/chat";
import { config } from "./ipc-handlers/config";
import { context } from "./ipc-handlers/context";
import { diagnostics } from "./ipc-handlers/diagnostics";
import { domain } from "./ipc-handlers/domain";
import { insights } from "./ipc-handlers/insights";
import { search } from "./ipc-handlers/search";
import { trash } from "./ipc-handlers/trash";
import { understanding } from "./ipc-handlers/understanding";
import { understandingCanvas } from "./ipc-handlers/understanding-canvas";

// Register asset:// as a privileged scheme before app is ready
registerAssetScheme();
app.setName(APP_NAME);
// electron-effect-rpc 的 IPC 编码校验引用 SharedArrayBuffer（boundary.ts 的
// isIpcEncodedValue 快路径）；renderer 默认未启用会导致大 payload（如 saveCanvas
// 文档）编码时抛 ReferenceError、调用被静默吞掉。必须在 ready 前开启。
app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");

const explicitUserDataDir = getRuntimeArg("reflecta-user-data-dir");
if (explicitUserDataDir) {
  app.setPath("userData", explicitUserDataDir);
}
initializeLogging();

const createWindow = (option?: Electron.BrowserWindowConstructorOptions, route?: string) => {
  const savedWindowState = readConfig().windowState;
  const hasValidSavedSize =
    savedWindowState &&
    Number.isInteger(savedWindowState.width) &&
    Number.isInteger(savedWindowState.height) &&
    savedWindowState.width >= 400 &&
    savedWindowState.height >= 300;

  // Create the browser window.
  option = merge(
    {},
    {
      width: hasValidSavedSize ? savedWindowState.width : 900,
      height: hasValidSavedSize ? savedWindowState.height : 670,
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
    if (savedWindowState?.isMaximized !== false) mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("close", () => {
    const { width, height } = mainWindow.getNormalBounds();
    writeConfig({
      windowState: {
        width,
        height,
        isMaximized: mainWindow.isMaximized(),
      },
    });
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
// A7（修订）：不再按“迁移版本 ≥ 1.4.0”一刀切重建——迁移显式声明
// （requestRetrievalIndexRebuild）时，重建放到后台执行，不阻塞窗口创建。
app.whenReady().then(async () => {
  const { retrievalIndexRebuildRequested } = await initializeDB();
  if (retrievalIndexRebuildRequested) {
    appLog.info("retrieval.index.rebuild-started", {
      reason: "projection-changing migration executed",
    });
    void retrievalIndexCoordinator
      .rebuild()
      .catch((error) => appLog.error("retrieval index rebuild failed on startup", error));
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

  startAutomaticUpdateChecks();

  // Effect IPC（electron-effect-rpc）—— 单一 app kit，typed domain error 跨进程往返。
  // 各域 handler 在 ipc-handlers/ 按域拆文件（业务逻辑在 services/），此处只做汇总与注册：
  // 域前缀 → 契约错误构造器由 rpc-guard 按方法名解析；全局兜底（catchAll + timeout + 日志）在注册处一次性包裹。
  // 必须在 createWindow 之前注册：renderer 一旦加载就会发起查询，若 handler 未就绪
  // 会命中 “No handler registered” 竞态，页面查询失败挂起（冷/热启动均可能撞上）。
  const handlerModules = [
    about,
    asset,
    canvas,
    chat,
    config,
    context,
    diagnostics,
    domain,
    insights,
    search,
    trash,
    understanding,
    understandingCanvas,
  ];
  const DOMAIN_IPC_ERROR: Record<string, (message: string) => unknown> = {};
  for (const module of handlerModules) {
    if (module.error) DOMAIN_IPC_ERROR[module.domain] = module.error;
  }
  const ipcHandlers = Object.assign(
    {},
    ...handlerModules.map((module) => module.handlers),
  ) as Record<string, HandlerLike>;
  const guardedHandlers = guardIpcHandlers(
    ipcHandlers,
    (name) => DOMAIN_IPC_ERROR[name.split(".")[0]],
  );
  // 整个 options 过一次 as unknown as（R=never 仅存在于调用上下文，静态取不到）；
  // 运行时不变，仅让 handlers 经 guardIpcHandlers 包裹后通过契约类型。
  const appMain = appIpc.main({
    ipcMain,
    handlers: guardedHandlers,
    context: getEffectLoggingContext(),
    getWindows: () => BrowserWindow.getAllWindows(),
    diagnostics: {
      rpc: {
        onDecodeFailure: (details: Record<string, unknown>) =>
          ipcLog.error("ipc.request.decode-failed", details),
        onProtocolError: (details: Record<string, unknown>) =>
          ipcLog.error("ipc.response.encode-failed", details),
      },
    },
  } as unknown as Parameters<typeof appIpc.main>[0]);
  appMain.start();
  app.once("before-quit", () => {
    appMain.dispose();
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
