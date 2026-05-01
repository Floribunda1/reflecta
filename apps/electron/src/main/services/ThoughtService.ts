import type {
  CreateThoughtInput,
  ListThoughtsFilter,
  ThoughtDTO,
  ThoughtSummaryDTO,
  UpdateThoughtInput,
} from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { thoughtService } from "./core";

export class ThoughtService extends IpcService {
  static readonly groupName = "thought";

  @IpcMethod()
  async listThoughts(filter?: ListThoughtsFilter): Promise<ThoughtSummaryDTO[]> {
    return thoughtService.listThoughts(filter);
  }

  @IpcMethod()
  async getThoughtById(id: string): Promise<ThoughtDTO | null> {
    return thoughtService.getThoughtById(id);
  }

  @IpcMethod()
  async createThought(input: CreateThoughtInput): Promise<ThoughtDTO> {
    return thoughtService.createThought(input);
  }

  @IpcMethod()
  async updateThought(id: string, input: UpdateThoughtInput): Promise<ThoughtDTO> {
    return thoughtService.updateThought(id, input);
  }

  @IpcMethod()
  async deleteThought(id: string): Promise<void> {
    return thoughtService.deleteThought(id);
  }

  @IpcMethod()
  async restoreThought(id: string): Promise<void> {
    return thoughtService.restoreThought(id);
  }

  @IpcMethod()
  async permanentlyDeleteThought(id: string): Promise<void> {
    return thoughtService.permanentlyDeleteThought(id);
  }

  @IpcMethod()
  async addConnection(sourceId: string, targetId: string): Promise<void> {
    return thoughtService.addConnection(sourceId, targetId);
  }

  @IpcMethod()
  async removeConnection(sourceId: string, targetId: string): Promise<void> {
    return thoughtService.removeConnection(sourceId, targetId);
  }

  @IpcMethod()
  async resolveWikiLinkTarget(target: string): Promise<ThoughtSummaryDTO | null> {
    return thoughtService.resolveWikiLinkTarget(target);
  }
}
