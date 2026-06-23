import type {
  CreateUnderstandingInput,
  ListUnderstandingsFilter,
  UnderstandingDTO,
  UnderstandingSummaryDTO,
  UpdateUnderstandingInput,
} from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { understandingService } from "./core";

export class UnderstandingService extends IpcService {
  static readonly groupName = "understanding";

  @IpcMethod()
  async listUnderstandings(filter?: ListUnderstandingsFilter): Promise<UnderstandingSummaryDTO[]> {
    return understandingService.listUnderstandings(filter);
  }

  @IpcMethod()
  async getUnderstandingById(id: string): Promise<UnderstandingDTO | null> {
    return understandingService.getUnderstandingById(id);
  }

  @IpcMethod()
  async createUnderstanding(input: CreateUnderstandingInput): Promise<UnderstandingDTO> {
    return understandingService.createUnderstanding(input);
  }

  @IpcMethod()
  async updateUnderstanding(
    id: string,
    input: UpdateUnderstandingInput,
  ): Promise<UnderstandingDTO> {
    return understandingService.updateUnderstanding(id, input);
  }

  @IpcMethod()
  async deleteUnderstanding(id: string): Promise<void> {
    return understandingService.deleteUnderstanding(id);
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
