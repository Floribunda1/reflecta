import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Context, Effect } from "effect";
import { merge } from "lodash-es";
import "./services";
import { initializeDB } from "./db";
import { parseMigrationVersion, compareVersions } from "@reflecta/server";
import { registerAssetScheme, handleAssetProtocol } from "./assetProtocol";
import { APP_NAME, appLog, getLogFilePath, initializeLogging } from "./logger";
import { preloadScript, rendererHtml } from "./paths";
import { retrievalEmbeddingRunner } from "./retrievalEmbeddingRunner";
import { retrievalIndexCoordinator } from "./retrievalIndexCoordinator";
import { getRuntimeArg } from "./runtime-args";
import { startAutomaticUpdateChecks } from "./updater";
import {
  checkForUpdates,
  getLastCheckAt,
  isUpdateCheckInProgress,
  isUpdateCheckSupported,
} from "./updater";
import { guardIpcHandlers, type HandlerLike } from "./rpc-guard";
import {
  appIpc,
  TrashListError,
  DomainListError,
  ContextListError,
  AssetError,
  CanvasExportError,
  InsightsError,
  UnderstandingError,
  CanvasError,
  ConfigError,
  ChatError,
  SearchError,
} from "../ipc";
import {
  trashService,
  understandingService,
  domainService,
  contextService,
  searchService,
  understandingCanvasService,
} from "./services/core";
import { getRecapData as getRecapDataOp } from "./services/insights-ops";
import * as configOps from "./services/config-ops";
import * as chatOps from "./services/chat-ops";
import {
  saveAsset as saveAssetOp,
  scanOrphanAssets,
  cleanOrphanAssets,
  openAsset,
  openExternalPath,
  revealAsset,
} from "./services/asset-ops";

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

  startAutomaticUpdateChecks();
  createWindow();

  // Effect IPC（electron-effect-rpc）—— 单一 app kit，typed domain error 跨进程往返
  const ipcError = (message: string) => new TrashListError({ reason: message, code: 500 });
  const domainErr = (message: string) => new DomainListError({ reason: message, code: 500 });
  // domain 域核心已 Effect 化：把服务端 DomainError 映射到 IPC 契约错误。
  // 错误映射已收敛到 rpc-guard（HttpRouter.catchAll 等价物）——此处直通，业务零仪式。
  const runDomain = <A>(program: Effect.Effect<A, import("@reflecta/server").DomainError>) =>
    program;
  const ctxErr = (message: string) => new ContextListError({ reason: message, code: 500 });
  // context 域核心已 Effect 化：服务端 ContextError → IPC 契约错误。
  // 错误映射已收敛到 rpc-guard——直通
  const runContext = <A>(program: Effect.Effect<A, import("@reflecta/server").ContextError>) =>
    program;
  const assetErr = (message: string) => new AssetError({ reason: message, code: 500 });
  const insightsErr = (message: string) => new InsightsError({ reason: message, code: 500 });
  const uErr = (message: string) => new UnderstandingError({ reason: message, code: 500 });
  // trash 的 understanding 操作按 trash 契约错误（TrashListError）映射。
  // 错误映射已收敛到 rpc-guard——直通（仅保留成功映射）
  const runTrashUnderstanding = <A>(
    program: Effect.Effect<A, import("@reflecta/server").UnderstandingError>,
  ) => program.pipe(Effect.map(() => undefined));
  // understanding 域核心已 Effect 化：服务端 UnderstandingError → IPC 契约错误。
  // 错误映射已收敛到 rpc-guard（HttpRouter.catchAll 等价物）——此处直通，业务零仪式。
  const runUnderstanding = <A>(
    program: Effect.Effect<A, import("@reflecta/server").UnderstandingError>,
  ) => program;
  const cErr = (message: string) => new CanvasError({ reason: message, code: 500 });
  const cfgErr = (message: string) => new ConfigError({ reason: message, code: 500 });
  const chatErr = (message: string) => new ChatError({ reason: message, code: 500 });
  const searchErr = (message: string) => new SearchError({ reason: message, code: 500 });
  // 域前缀 → 契约错误构造器：guardIpcHandlers 按方法名前缀解析，未列出的域原样透传。
  const DOMAIN_IPC_ERROR: Record<string, (message: string) => unknown> = {
    understandingCanvas: cErr,
    understanding: uErr,
    trash: ipcError,
    domain: domainErr,
    context: ctxErr,
    asset: assetErr,
    insights: insightsErr,
    config: cfgErr,
    chat: chatErr,
    search: searchErr,
  };
  // search 域核心的 SearchDomainError（embedding/index IO typed 错误）→ IPC 契约错误。
  // 错误映射已收敛到 rpc-guard——直通
  const runSearch = <A>(program: Effect.Effect<A, import("@reflecta/server").SearchDomainError>) =>
    program;
  // 业务 handlers 对象：全部纯 Effect、零错误仪式。
  // 全局错误兜底在注册处一次性包裹（等价 HttpRouter.catchAll）：
  // 已知失败→域契约错误（保留原文）、未知/defect→操作失败+原文、挂起→typed 超时、全部落日志。
  // 业务对象保持松类型（各域 Effect 直接透传，契约错误由 guard 在注册处统一归一）
  const ipcHandlers: Record<string, HandlerLike> = {
    "trash.listTrashedUnderstandings": () => trashService.listTrashedUnderstandings(),
    "trash.restoreUnderstanding": ({ id }) =>
      runTrashUnderstanding(understandingService.restoreUnderstanding(id)),
    "trash.permanentlyDeleteUnderstanding": ({ id }) =>
      runTrashUnderstanding(understandingService.permanentlyDeleteUnderstanding(id)),
    "about.getVersionInfo": () =>
      Effect.sync(() => ({
        name: APP_NAME,
        version: app.getVersion(),
        arch: process.arch,
        platform: process.platform,
        packaged: app.isPackaged,
        updateCheckSupported: isUpdateCheckSupported(),
        checking: isUpdateCheckSupported() && isUpdateCheckInProgress(),
        lastCheckAt: getLastCheckAt(),
      })),
    "about.checkForUpdates": () =>
      Effect.promise(async () => {
        const started = await checkForUpdates(true);
        return { started };
      }),
    "domain.listDomains": () => runDomain(domainService.listDomains()),
    "domain.getDomainById": ({ id }) => runDomain(domainService.getDomainById(id)),
    "domain.reorderDomains": ({ items }) =>
      runDomain(domainService.reorderDomains([...items])).pipe(Effect.map(() => undefined)),
    "domain.createDomain": ({ input }) => runDomain(domainService.createDomain(input)),
    "domain.updateDomain": ({ id, input }) => runDomain(domainService.updateDomain(id, input)),
    "domain.deleteDomain": ({ id, deleteUnderstandings }) =>
      runDomain(domainService.deleteDomain(id, deleteUnderstandings)).pipe(
        Effect.map(() => undefined),
      ),
    "context.listContextsByUnderstanding": ({ understandingId }) =>
      runContext(contextService.listContextsByUnderstanding(understandingId)),
    "context.getContextById": ({ id }) => runContext(contextService.getContextById(id)),
    "context.createContext": ({ input }) =>
      runContext(
        contextService.createContext(input as import("@reflecta/server").CreateContextInput),
      ),
    "context.updateContext": ({ id, input }) =>
      runContext(
        contextService.updateContext(id, input as import("@reflecta/server").UpdateContextInput),
      ),
    "context.deleteContext": ({ id }) =>
      runContext(contextService.deleteContext(id)).pipe(Effect.map(() => undefined)),
    "context.restoreContext": ({ id }) =>
      runContext(contextService.restoreContext(id)).pipe(Effect.map(() => undefined)),
    "context.permanentlyDeleteContext": ({ id }) =>
      runContext(contextService.permanentlyDeleteContext(id)).pipe(Effect.map(() => undefined)),
    "context.listTrashedContexts": () => runContext(contextService.listTrashedContexts()),
    "asset.saveAsset": ({ buffer, filename }) =>
      Effect.tryPromise({
        try: () => saveAssetOp(new Uint8Array(buffer).buffer, filename),
        catch: (e) => assetErr(e instanceof Error ? e.message : String(e)),
      }),
    "asset.scanOrphanAssets": () =>
      Effect.tryPromise({
        try: () => scanOrphanAssets(),
        catch: (e) => assetErr(e instanceof Error ? e.message : String(e)),
      }),
    "asset.cleanOrphanAssets": ({ filenames }) =>
      Effect.tryPromise({
        try: () => cleanOrphanAssets([...filenames]),
        catch: (e) => assetErr(e instanceof Error ? e.message : String(e)),
      }),
    "asset.openAsset": ({ filename }) =>
      Effect.tryPromise({
        try: () => openAsset(filename),
        catch: (e) => assetErr(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.map(() => undefined)),
    "asset.openExternalPath": ({ filePath }) =>
      Effect.tryPromise({
        try: () => openExternalPath(filePath),
        catch: (e) => assetErr(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.map(() => undefined)),
    "asset.revealAsset": ({ filename }) =>
      Effect.tryPromise({
        try: () => revealAsset(filename),
        catch: (e) => assetErr(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.map(() => undefined)),
    "canvas.exportPng": ({ dataUrl, suggestedName }) =>
      Effect.tryPromise({
        try: async () => {
          const result = await dialog.showSaveDialog({
            title: "导出画布为 PNG",
            defaultPath: `${suggestedName}.png`,
            filters: [{ name: "PNG 图片", extensions: ["png"] }],
          });
          if (result.canceled || !result.filePath) return null;
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
          const buffer = Buffer.from(base64, "base64");
          await mkdir(path.dirname(result.filePath), { recursive: true });
          await writeFile(result.filePath, buffer);
          return result.filePath;
        },
        catch: (e) =>
          new CanvasExportError({
            reason: e instanceof Error ? e.message : String(e),
            code: 500,
          }),
      }),
    "diagnostics.getLogFilePath": () => Effect.sync(() => getLogFilePath()),
    "diagnostics.showLogFile": () =>
      Effect.sync(() => {
        const logFilePath = getLogFilePath();
        shell.showItemInFolder(logFilePath);
        return logFilePath;
      }),
    "search.searchUnderstandings": ({ query, options }) =>
      runSearch(
        searchService.searchUnderstandings(
          query,
          options as import("@reflecta/server").SearchOptions | undefined,
        ),
      ),
    "search.searchContexts": ({ query, options }) =>
      runSearch(
        searchService.searchContexts(
          query,
          options as import("@reflecta/server").SearchOptions | undefined,
        ),
      ),
    "search.search": ({ query, options }) =>
      runSearch(
        searchService.search(
          query,
          options as import("@reflecta/server").SearchOptions | undefined,
        ),
      ),
    "insights.getRecapData": () =>
      Effect.tryPromise({
        try: () => getRecapDataOp(),
        catch: (e) => insightsErr(e instanceof Error ? e.message : String(e)),
      }),
    "understanding.listUnderstandings": ({ filter }) =>
      runUnderstanding(
        understandingService.listUnderstandings(
          filter as import("@reflecta/server").ListUnderstandingsFilter | undefined,
        ),
      ),
    "understanding.getUnderstandingById": ({ id }) =>
      runUnderstanding(understandingService.getUnderstandingById(id)),
    "understanding.createUnderstanding": ({ input }) =>
      runUnderstanding(
        understandingService.createUnderstanding(
          input as unknown as import("@reflecta/server").CreateUnderstandingInput,
        ),
      ),
    "understanding.updateUnderstanding": ({ id, input }) =>
      runUnderstanding(
        understandingService.updateUnderstanding(
          id,
          input as unknown as import("@reflecta/server").UpdateUnderstandingInput,
        ),
      ),
    "understanding.deleteUnderstanding": ({ id }) =>
      runUnderstanding(understandingService.deleteUnderstanding(id)).pipe(
        Effect.map(() => undefined),
      ),
    "understanding.restoreUnderstanding": ({ id }) =>
      runUnderstanding(understandingService.restoreUnderstanding(id)).pipe(
        Effect.map(() => undefined),
      ),
    "understanding.permanentlyDeleteUnderstanding": ({ id }) =>
      runUnderstanding(understandingService.permanentlyDeleteUnderstanding(id)).pipe(
        Effect.map(() => undefined),
      ),
    "understandingCanvas.listCanvases": () => understandingCanvasService.listCanvases(),
    "understandingCanvas.listCanvasesByUnderstanding": ({ understandingId }) =>
      understandingCanvasService.listCanvasesByUnderstanding(understandingId),
    "understandingCanvas.getCanvas": ({ id }) =>
      understandingCanvasService.getCanvasDetail(id, { includeBodies: true }),
    "understandingCanvas.createCanvas": ({ input }) =>
      understandingCanvasService.createCanvas(
        input as import("@reflecta/server").CreateCanvasInput | undefined,
      ),
    "understandingCanvas.updateCanvas": ({ id, input }) =>
      understandingCanvasService.updateCanvas(
        id,
        input as import("@reflecta/server").UpdateCanvasInput,
      ),
    "understandingCanvas.deleteCanvas": ({ id }) =>
      understandingCanvasService.deleteCanvas(id).pipe(Effect.map(() => undefined)),
    "understandingCanvas.updateViewport": ({ canvasId, viewport }) =>
      understandingCanvasService
        .updateViewport(canvasId, viewport as import("@reflecta/server").Viewport)
        .pipe(Effect.map(() => undefined)),
    "understandingCanvas.saveCanvas": ({ canvasId, document }) =>
      understandingCanvasService.saveCanvas(
        canvasId,
        document as import("@reflecta/server").CanvasDocument,
      ),

    "config.openDirectoryPicker": () =>
      Effect.tryPromise({
        try: () => configOps.openDirectoryPicker(),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.setContentStorageRoot": ({ newPath }) =>
      Effect.try({
        try: () => configOps.setContentStorageRoot(newPath),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.restartApp": () => Effect.sync(() => configOps.restartApp()),
    "config.getConfig": () => Effect.sync(() => configOps.getConfig()),
    "config.getAiConfig": () => Effect.sync(() => configOps.getAiConfig()),
    "config.setAiConfig": ({ config }) =>
      Effect.try({
        try: () => configOps.setAiConfig(config as import("./config").AiConfig),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.getCodexAuthStatus": () => Effect.sync(() => configOps.getCodexAuthStatus()),
    "config.connectCodex": () =>
      Effect.tryPromise({
        try: () => configOps.connectCodex(),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.disconnectCodex": () =>
      Effect.tryPromise({
        try: () => configOps.disconnectCodex(),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.map(() => undefined)),
    "config.getRetrievalConfig": () => Effect.sync(() => configOps.getRetrievalConfig()),
    "config.setRetrievalConfig": ({ config }) =>
      Effect.try({
        try: () => configOps.setRetrievalConfig(config as import("./config").RetrievalConfig),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.getRetrievalEmbeddingModelStatus": () =>
      Effect.sync(() => configOps.getRetrievalEmbeddingModelStatus()),
    "config.downloadDefaultRetrievalEmbeddingModel": () =>
      Effect.tryPromise({
        try: () => configOps.downloadDefaultRetrievalEmbeddingModel(),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.getRetrievalIndexStatus": () =>
      Effect.tryPromise({
        try: () => configOps.getRetrievalIndexStatus(),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.rebuildRetrievalIndex": () =>
      Effect.tryPromise({
        try: () => configOps.rebuildRetrievalIndex(),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.listAiModelOptions": () => Effect.sync(() => configOps.listAiModelOptions()),
    "config.listAiProviderDefinitions": () =>
      Effect.sync(() => configOps.listAiProviderDefinitions()),
    "config.getActiveAgentModel": () => Effect.sync(() => configOps.getActiveAgentModel()),
    "config.getActiveAgentReasoningLevel": () =>
      Effect.sync(() => configOps.getActiveAgentReasoningLevel()),
    "config.setActiveAgentModel": ({ selection }) =>
      Effect.try({
        try: () => configOps.setActiveAgentModel(selection as import("./config").AiModelSelection),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "config.setActiveAgentReasoningLevel": ({ level }) =>
      Effect.try({
        try: () => configOps.setActiveAgentReasoningLevel(level),
        catch: (e) => cfgErr(e instanceof Error ? e.message : String(e)),
      }),
    "chat.listThreads": () =>
      Effect.tryPromise({
        try: () => chatOps.listThreads(),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }),
    "chat.listSkills": () =>
      Effect.try({
        try: () => chatOps.listSkills(),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }),
    "chat.createThread": ({ title }) =>
      Effect.try({
        try: () => chatOps.createThread(title),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }),
    "chat.renameThread": ({ threadId, title }) =>
      Effect.tryPromise({
        try: () => chatOps.renameThread(threadId, title),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.map(() => undefined)),
    "chat.generateThreadTitle": ({ threadId }) =>
      Effect.tryPromise({
        try: () => chatOps.generateThreadTitle(threadId),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }),
    "chat.archiveThread": ({ threadId }) =>
      Effect.tryPromise({
        try: () => chatOps.archiveThread(threadId),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.map(() => undefined)),
    "chat.deleteThread": ({ threadId }) =>
      Effect.tryPromise({
        try: () => chatOps.deleteThread(threadId),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.map(() => undefined)),
    "chat.forkThreadFromMessage": ({ threadId, messageId }) =>
      Effect.tryPromise({
        try: () => chatOps.forkThreadFromMessage(threadId, messageId),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }),
    "chat.exportMarkdown": ({ filename, markdown }) =>
      Effect.tryPromise({
        try: () => chatOps.exportMarkdown(filename, markdown),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }),
    "chat.readSessionProjection": ({ sessionId }) =>
      Effect.tryPromise({
        try: () =>
          chatOps.readSessionProjection(sessionId) as Promise<
            import("../ipc").AgentSessionProjection
          >,
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }),
    "chat.sendAgentCommand": ({ command }) =>
      Effect.tryPromise({
        try: () => chatOps.sendAgentCommand(command as import("@shared/agent").AgentCommand),
        catch: (e) => chatErr(e instanceof Error ? e.message : String(e)),
      }).pipe(Effect.map(() => undefined)),
  };
  const guardedHandlers = guardIpcHandlers(
    ipcHandlers,
    (name) => DOMAIN_IPC_ERROR[name.split(".")[0]],
    (text) => appLog.error(text),
  );
  // 整个 options 过一次 as unknown as（R=never 仅存在于调用上下文，静态取不到）；
  // 运行时不变，仅让 handlers 经 guardIpcHandlers 包裹后通过契约类型。
  const appMain = appIpc.main({
    ipcMain,
    handlers: guardedHandlers,
    context: Context.empty(),
    getWindows: () => BrowserWindow.getAllWindows(),
  } as unknown as Parameters<typeof appIpc.main>[0]);
  appMain.start();
  app.once("before-quit", () => {
    appMain.dispose();
  });

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
