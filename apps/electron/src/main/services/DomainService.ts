import type {
  Domain,
  CreateDomainInput,
  ReorderDomainItem,
  UpdateDomainInput,
} from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { domainService } from "./core";

export class DomainService extends IpcService {
  static readonly groupName = "domain";

  @IpcMethod()
  async listDomains(): Promise<Domain[]> {
    return domainService.listDomains();
  }

  @IpcMethod()
  async getDomainById(id: string): Promise<Domain | null> {
    return domainService.getDomainById(id);
  }

  @IpcMethod()
  async reorderDomains(items: ReorderDomainItem[]): Promise<void> {
    return domainService.reorderDomains(items);
  }

  @IpcMethod()
  async createDomain(input: CreateDomainInput): Promise<Domain> {
    return domainService.createDomain(input);
  }

  @IpcMethod()
  async updateDomain(id: string, input: UpdateDomainInput): Promise<Domain> {
    return domainService.updateDomain(id, input);
  }

  @IpcMethod()
  async deleteDomain(id: string, deleteUnderstandings = false): Promise<void> {
    return domainService.deleteDomain(id, deleteUnderstandings);
  }
}
