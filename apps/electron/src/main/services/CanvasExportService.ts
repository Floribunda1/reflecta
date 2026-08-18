import { dialog } from "electron";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { IpcMethod, IpcService } from "electron-ipc-decorator";

/**
 * PNG 导出保存（M2-8 / T6）：renderer 用 X6 `toPNG` 得 dataURL，本服务弹系统
 * 保存对话框并写盘。把渲染与文件系统隔离在主进程。
 */
export class CanvasExportService extends IpcService {
  static readonly groupName = "canvas";

  @IpcMethod()
  async exportPng(dataUrl: string, suggestedName: string): Promise<string | null> {
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
  }
}
