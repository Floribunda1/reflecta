import type { TrashedUnderstandingDTO } from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { understandingService, trashService } from "./core";

export class TrashService extends IpcService {
  static readonly groupName = "trash";

  @IpcMethod()
  async listTrashedUnderstandings(): Promise<TrashedUnderstandingDTO[]> {
    return trashService.listTrashedUnderstandings();
  }

  @IpcMethod()
  async restoreUnderstanding(id: string): Promise<void> {
    return understandingService.restoreUnderstanding(id);
  }

  @IpcMethod()
  async permanentlyDeleteUnderstanding(id: string): Promise<void> {
    return understandingService.permanentlyDeleteUnderstanding(id);
  }
}
