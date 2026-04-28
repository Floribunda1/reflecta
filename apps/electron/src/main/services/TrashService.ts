import type { TrashedThoughtDTO } from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { thoughtService, trashService } from "./core";

export class TrashService extends IpcService {
  static readonly groupName = "trash";

  @IpcMethod()
  async listTrashedThoughts(): Promise<TrashedThoughtDTO[]> {
    return trashService.listTrashedThoughts();
  }

  @IpcMethod()
  async restoreThought(id: string): Promise<void> {
    return thoughtService.restoreThought(id);
  }

  @IpcMethod()
  async permanentlyDeleteThought(id: string): Promise<void> {
    return thoughtService.permanentlyDeleteThought(id);
  }
}
