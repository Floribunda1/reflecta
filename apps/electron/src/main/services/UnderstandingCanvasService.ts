import type {
  CanvasDTO,
  CanvasDetailDTO,
  CanvasDocument,
  CreateCanvasInput,
  UpdateCanvasInput,
  Viewport,
} from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { understandingCanvasService } from "./core";

export class UnderstandingCanvasService extends IpcService {
  static readonly groupName = "understandingCanvas";

  @IpcMethod()
  async listCanvases(): Promise<CanvasDTO[]> {
    return understandingCanvasService.listCanvases();
  }

  @IpcMethod()
  async listCanvasesByUnderstanding(understandingId: string): Promise<CanvasDTO[]> {
    return understandingCanvasService.listCanvasesByUnderstanding(understandingId);
  }

  @IpcMethod()
  async getCanvas(id: string): Promise<CanvasDetailDTO | null> {
    // renderer 交互编辑器需要正文（理解卡全文）；Agent / CLI 走骨架默认
    return understandingCanvasService.getCanvasDetail(id, { includeBodies: true });
  }

  @IpcMethod()
  async createCanvas(input?: CreateCanvasInput): Promise<CanvasDTO> {
    return understandingCanvasService.createCanvas(input);
  }

  @IpcMethod()
  async updateCanvas(id: string, input: UpdateCanvasInput): Promise<CanvasDTO | null> {
    return understandingCanvasService.updateCanvas(id, input);
  }

  @IpcMethod()
  async deleteCanvas(id: string): Promise<void> {
    return understandingCanvasService.deleteCanvas(id);
  }

  @IpcMethod()
  async updateViewport(id: string, viewport: Viewport): Promise<void> {
    return understandingCanvasService.updateViewport(id, viewport);
  }

  @IpcMethod()
  async saveCanvas(canvasId: string, document: CanvasDocument): Promise<void> {
    return understandingCanvasService.saveCanvas(canvasId, document);
  }
}
