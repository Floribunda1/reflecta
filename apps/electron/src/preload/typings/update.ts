/**
 * 主进程 → 渲染进程「一次更新检查结束」的广播通道。
 * 渲染进程设置页面的 About 区域订阅该事件，用于刷新检查状态与上次检查时间。
 */
export const UPDATE_CHECK_FINISHED_CHANNEL = "about:update-check-finished";

export interface UpdateCheckFinishedPayload {
  /** 检查完成时间（ISO 字符串）；检查失败时为 null。 */
  checkedAt: string | null;
  /** 检查是否失败（失败时 updater 已弹出系统错误对话框）。 */
  failed: boolean;
}

/** 设置 → About 区域展示的应用信息与更新能力。 */
export interface AboutVersionInfo {
  /** 应用名称（与菜单栏一致）。 */
  name: string;
  /** 当前安装的版本号。 */
  version: string;
  /** 运行架构，如 arm64 / x64。 */
  arch: string;
  /** 当前平台。 */
  platform: string;
  /** 是否为打包安装版（安装版才携带 Sparkle 更新组件）。 */
  packaged: boolean;
  /** 当前环境是否支持检查更新（macOS 打包版）。 */
  updateCheckSupported: boolean;
  /** 是否有一次更新检查正在进行（手动或自动）。 */
  checking: boolean;
  /** 最近一次检查完成时间（ISO 字符串）；从未检查过为 null。 */
  lastCheckAt: string | null;
}
