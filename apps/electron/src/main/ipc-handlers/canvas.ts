/** canvas 域 IPC handlers（导出画布为 PNG：保存对话框 + 写文件，失败折叠为 CanvasExportError）。 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dialog } from "electron";
import { CanvasExportError } from "../../ipc";
import { liftPromise, type HandlerModule } from "./util";

const error = (message: string) => new CanvasExportError({ reason: message, code: 500 });

export const canvas: HandlerModule = {
  domain: "canvas",
  handlers: {
    "canvas.exportPng": ({ dataUrl, suggestedName }) =>
      liftPromise(error, async () => {
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
      }),
  },
};
