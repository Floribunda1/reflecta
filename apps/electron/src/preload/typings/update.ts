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

export type { AboutVersionInfo } from "@reflecta/shared";
