import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { app, BrowserWindow, dialog, Menu, MenuItem } from "electron";
import { appLog } from "./logger";

const FEED_URL = "https://github.com/Floribunda1/reflecta/releases/latest/download/appcast.xml";
const LATEST_RELEASE_URL = "https://api.github.com/repos/Floribunda1/reflecta/releases/latest";
const AUTOMATIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let checking = false;

export function classifySparkleProbeExitCode(code: number | null): "available" | "current" {
  if (code === 0) return "available";
  if (code === 4) return "current";
  throw new Error(`Sparkle 检查更新失败（退出码 ${code ?? "unknown"}）`);
}

function appBundlePath(): string {
  return path.resolve(path.dirname(process.execPath), "../..");
}

function sparkleExecutablePath(): string {
  return path.join(process.resourcesPath, "sparkle.app", "Contents", "MacOS", "sparkle");
}

function sparkleArguments(mode: "probe" | "install"): string[] {
  const bundle = appBundlePath();
  const common = ["--feed-url", FEED_URL, "--user-agent-name", `Reflecta/${app.getVersion()}`];
  return mode === "probe"
    ? ["--probe", ...common, bundle]
    : [
        "--check-immediately",
        "--application",
        bundle,
        "--interactive",
        "--allow-major-upgrades",
        ...common,
        bundle,
      ];
}

function showMessage(options: Electron.MessageBoxOptions) {
  const window = BrowserWindow.getFocusedWindow();
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
}

async function probeForUpdate(): Promise<"available" | "current"> {
  const executable = sparkleExecutablePath();
  if (!existsSync(executable)) throw new Error("安装包中缺少 Sparkle 更新组件");

  const { code, stderr } = await new Promise<{ code: number | null; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(executable, sparkleArguments("probe"), {
        stdio: ["ignore", "ignore", "pipe"],
      });
      let stderr = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-16_384);
      });
      child.once("error", reject);
      child.once("close", (code) => resolve({ code, stderr }));
    },
  );

  try {
    return classifySparkleProbeExitCode(code);
  } catch (error) {
    const detail = stderr.trim();
    throw detail ? new Error(`${(error as Error).message}：${detail}`) : error;
  }
}

async function latestRelease(): Promise<{ tag: string; notes: string }> {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `Reflecta/${app.getVersion()}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`GitHub Release 请求失败（${response.status}）`);

  const release = (await response.json()) as Record<string, unknown>;
  return {
    tag: typeof release.tag_name === "string" ? release.tag_name : "新版本",
    notes:
      typeof release.body === "string" && release.body.trim()
        ? release.body.trim()
        : "这个版本没有提供更新说明。",
  };
}

function installUpdate(): void {
  const executable = sparkleExecutablePath();
  const child = spawn(executable, sparkleArguments("install"), {
    detached: true,
    stdio: "ignore",
  });
  child.once("error", (error) => {
    appLog.error("update.install.failed", { error: String(error) });
    void showMessage({
      type: "error",
      message: "无法启动更新安装",
      detail: String(error),
    });
  });
  child.unref();
  appLog.info("update.install.started");
}

export async function checkForUpdates(manual = false): Promise<void> {
  if (checking) return;
  if (process.platform !== "darwin" || !app.isPackaged) {
    if (manual) {
      await showMessage({
        type: "info",
        message: "检查更新只在已安装的 macOS 版本中可用",
      });
    }
    return;
  }

  checking = true;
  try {
    const status = await probeForUpdate();
    if (status === "current") {
      if (manual) {
        await showMessage({
          type: "info",
          message: "Reflecta 已经是最新版本",
          detail: `当前版本：${app.getVersion()}`,
        });
      }
      return;
    }

    let release = { tag: "新版本", notes: "更新说明暂时无法读取。" };
    try {
      release = await latestRelease();
    } catch (error) {
      appLog.warn("update.release-notes.failed", { error: String(error) });
    }

    const result = await showMessage({
      type: "info",
      buttons: ["现在更新", "稍后"],
      defaultId: 0,
      cancelId: 1,
      message: `发现 Reflecta ${release.tag}`,
      detail: release.notes,
      noLink: true,
    });
    if (result.response === 0) installUpdate();
  } catch (error) {
    appLog.error("update.check.failed", { error: String(error) });
    if (manual) {
      await showMessage({
        type: "error",
        message: "检查更新失败",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  } finally {
    checking = false;
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
