import type {
  ContextDTO,
  CreateContextInput,
  TrashedContextDTO,
  UpdateContextInput,
} from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { contextService } from "./core";

export class ContextService extends IpcService {
  static readonly groupName = "context";

  @IpcMethod()
  async listContextsByUnderstanding(understandingId: string): Promise<ContextDTO[]> {
    return contextService.listContextsByUnderstanding(understandingId);
  }

  @IpcMethod()
  async getContextById(id: string): Promise<ContextDTO | null> {
    return contextService.getContextById(id);
  }

  @IpcMethod()
  async createContext(input: CreateContextInput): Promise<ContextDTO> {
    return contextService.createContext(input);
  }

  @IpcMethod()
  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDTO> {
    return contextService.updateContext(id, input);
  }

  @IpcMethod()
  async deleteContext(id: string): Promise<void> {
    return contextService.deleteContext(id);
  }

  @IpcMethod()
  async restoreContext(id: string): Promise<void> {
    return contextService.restoreContext(id);
  }

  @IpcMethod()
  async permanentlyDeleteContext(id: string): Promise<void> {
    return contextService.permanentlyDeleteContext(id);
  }

  @IpcMethod()
  async listTrashedContexts(): Promise<TrashedContextDTO[]> {
    return contextService.listTrashedContexts();
  }
}
