import type { Domain } from "./types";
import { DomainCore } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class DomainElectronBff extends DomainCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb(), options.retrievalIndex);
  }

  async listDomains(): Promise<Domain[]> {
    return this.listDomainRows();
  }

  async getDomainById(id: string): Promise<Domain | null> {
    return this.getDomainRow(id);
  }
}
