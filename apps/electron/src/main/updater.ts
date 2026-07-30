import { existsSync } from "node:fs";
import path from "node:path";
import { type ChildProcess, spawn } from "node:child_process";
import { app, BrowserWindow, dialog, Menu, MenuItem } from "electron";
import { appLog } from "./logger";

const AUTOMATIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let activeUpdater: ChildProcess | null = null;

function appBundlePath(): string {
  return path.resolve(path.dirname(process.execPath), "../..");
}

function sparkleExecutablePath(): string {
  return path.join(
    process.resourcesPath,
    "reflecta-updater.app",
    "Contents",
    "MacOS",
    "reflecta-updater",
  );
}

export function createUpdaterArguments(bundlePath: string, manual: boolean): string[] {
  return [bundlePath, manual ? "--foreground" : "--background"];
}

function showMessage(options: Electron.MessageBoxOptions) {
  const window = BrowserWindow.getFocusedWindow();
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
}

function launchUpdater(manual: boolean): void {
  if (activeUpdater && activeUpdater.exitCode == null) {
    if (manual) activeUpdater.kill("SIGUSR1");
    return;
  }

  const executable = sparkleExecutablePath();
  if (!existsSync(executable)) throw new Error("安装包中缺少 Sparkle 更新组件");

  const child = spawn(executable, createUpdaterArguments(appBundlePath(), manual), {
    stdio: "ignore",
  });
  activeUpdater = child;
  child.once("spawn", () => appLog.info("update.check.started", { manual }));
  child.once("error", (error) => {
    if (activeUpdater === child) activeUpdater = null;
    appLog.error("update.check.failed", { error: String(error) });
    if (manual) {
      void showMessage({
        type: "error",
        message: "无法启动更新检查",
        detail: String(error),
      });
    }
  });
  child.once("close", (code, signal) => {
    if (activeUpdater === child) activeUpdater = null;
    if (code === 0 || signal) return;

    const error = `Sparkle 更新器退出（代码 ${code ?? "unknown"}）`;
    appLog.error("update.check.failed", { error });
    if (manual) {
      void showMessage({
        type: "error",
        message: "Check for Updates Failed",
        detail: error,
      });
    }
  });
}

export async function checkForUpdates(manual = false): Promise<void> {
  if (process.platform !== "darwin" || !app.isPackaged) {
    if (manual) {
      await showMessage({
        type: "info",
        message: "Check for Updates is only available on the installed macOS version",
      });
    }
    return;
  }

  try {
    launchUpdater(manual);
  } catch (error) {
    appLog.error("update.check.failed", { error: String(error) });
    if (manual) {
      await showMessage({
        type: "error",
        message: "Check for Updates Failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function installUpdateMenu(): void {
  if (process.platform !== "darwin") return;

  const menu = Menu.getApplicationMenu();
  const appMenu = menu?.items[0]?.submenu;
  if (!menu || !appMenu) {
    appLog.warn("update.menu.unavailable");
    return;
  }

  appMenu.insert(
    1,
    new MenuItem({
      label: "Check For Updates…",
      click: () => void checkForUpdates(true),
    }),
  );
  Menu.setApplicationMenu(menu);
}

export function startAutomaticUpdateChecks(): void {
  if (process.platform !== "darwin" || !app.isPackaged) return;

  const initialCheck = setTimeout(() => void checkForUpdates(), 15_000);
  const interval = setInterval(() => void checkForUpdates(), AUTOMATIC_CHECK_INTERVAL_MS);
  initialCheck.unref();
  interval.unref();
}
