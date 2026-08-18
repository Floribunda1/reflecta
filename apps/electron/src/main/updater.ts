import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type ChildProcess, spawn } from "node:child_process";
import { app, BrowserWindow, dialog } from "electron";
import type { UpdateCheckFinishedPayload } from "@shared/update";
import { UPDATE_CHECK_FINISHED_CHANNEL } from "@shared/update";
import { appLog } from "./logger";

const AUTOMATIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 15_000;

const CHECK_STATE_FILE = "update-check-state.json";

type CheckState = {
  /** 最近一次更新检查完成时间（ISO 字符串）。 */
  lastCheckAt?: string;
};

let activeUpdater: ChildProcess | null = null;
let pendingAutomaticCheck = false;
let checkStateCache: CheckState | null = null;

/**
 * 更新检查是否可用：只有打包安装的 macOS 版本带 Sparkle 更新组件，
 * Windows / Linux 构建暂无更新机制，About 区域会将按钮置灰并给出说明。
 */
export function isUpdateCheckSupported(): boolean {
  return process.platform === "darwin" && app.isPackaged;
}

/** 当前是否有一轮更新检查正在进行（手动或自动）。 */
export function isUpdateCheckInProgress(): boolean {
  return activeUpdater != null && activeUpdater.exitCode == null;
}

function checkStatePath(): string {
  return path.join(app.getPath("userData"), CHECK_STATE_FILE);
}

function readCheckState(): CheckState {
  if (checkStateCache) return checkStateCache;
  try {
    const parsed = JSON.parse(readFileSync(checkStatePath(), "utf8")) as CheckState;
    checkStateCache =
      parsed && typeof parsed.lastCheckAt === "string" ? { lastCheckAt: parsed.lastCheckAt } : {};
  } catch {
    checkStateCache = {};
  }
  return checkStateCache;
}

function persistCheckState(state: CheckState): void {
  checkStateCache = state;
  try {
    writeFileSync(checkStatePath(), JSON.stringify(state), "utf8");
  } catch (error) {
    // 状态记录失败不应影响更新检查本身，仅记录日志。
    appLog.warn("update.check-state.write-failed", { error: String(error) });
  }
}

/** 最近一次更新检查完成时间（ISO 字符串）；从未检查过为 null。 */
export function getLastCheckAt(): string | null {
  return readCheckState().lastCheckAt ?? null;
}

function broadcastUpdateCheckFinished(checkedAt: string | null, failed: boolean): void {
  const payload: UpdateCheckFinishedPayload = { checkedAt, failed };
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(UPDATE_CHECK_FINISHED_CHANNEL, payload);
  }
}

function appWindowIsFocused(): boolean {
  return BrowserWindow.getFocusedWindow() != null;
}

/**
 * Run one automatic update check. Sparkle's standard user driver shows the
 * update prompt as soon as a new version is found, so an automatic check must
 * never run while the user is in another app: defer it until a window regains
 * focus (see startAutomaticUpdateChecks). Manual checks are never gated.
 */
function runAutomaticUpdateCheck(): void {
  if (appWindowIsFocused()) {
    pendingAutomaticCheck = false;
    void checkForUpdates();
    return;
  }
  pendingAutomaticCheck = true;
}

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

    // 仅显式退出码 0 才视为成功完成并记录上次检查时间；
    // 非零且未被信号终止的退出才需要向用户报错（与原逻辑一致）。
    let checkedAt: string | null = null;
    if (code === 0) {
      checkedAt = new Date().toISOString();
      persistCheckState({ lastCheckAt: checkedAt });
    }
    const failed = code !== 0 && signal === null;
    broadcastUpdateCheckFinished(checkedAt, failed);

    if (!failed) return;

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

/**
 * 触发一次更新检查。manual 表示用户主动检查（前台模式，Sparkle 会弹出结果窗口），
 * 否则为后台自动检查。返回是否真的启动了检查进程。
 */
export async function checkForUpdates(manual = false): Promise<boolean> {
  if (!isUpdateCheckSupported()) {
    if (manual) {
      await showMessage({
        type: "info",
        message: "Check for Updates is only available on the installed macOS version",
      });
    }
    return false;
  }

  try {
    launchUpdater(manual);
    return true;
  } catch (error) {
    appLog.error("update.check.failed", { error: String(error) });
    if (manual) {
      await showMessage({
        type: "error",
        message: "Check for Updates Failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return false;
  }
}

/**
 * 手动检查更新的入口改由「设置 → 关于」提供（macOS 应用菜单的
 * Check For Updates… 已移除），后台自动检查仍然保留。
 */
export function startAutomaticUpdateChecks(): void {
  if (!isUpdateCheckSupported()) return;

  const initialCheck = setTimeout(runAutomaticUpdateCheck, INITIAL_CHECK_DELAY_MS);
  const interval = setInterval(runAutomaticUpdateCheck, AUTOMATIC_CHECK_INTERVAL_MS);
  initialCheck.unref();
  interval.unref();

  // A check that fired while the app was unfocused runs as soon as the user
  // comes back, instead of popping up over other software.
  app.on("browser-window-focus", () => {
    if (!pendingAutomaticCheck) return;
    pendingAutomaticCheck = false;
    void checkForUpdates();
  });
}
