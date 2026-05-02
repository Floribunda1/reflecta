import type { ContextDTO, CreateContextInput, UpdateContextInput } from "./types";
import type { TrashedContextDTO } from "../trash/types";
import { ContextCore } from "./core";
import { rowToContextDTO } from "../shared/bff-electron";
import type { ReflectaServerContext } from "../shared/types-electron";

export class ContextElectronBff extends ContextCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb());
  }

  async listContextsByThought(thoughtId: string): Promise<ContextDTO[]> {
    const rows = await this.listContextRows(thoughtId);
    return rows.map(rowToContextDTO);
  }

  async createContext(input: CreateContextInput): Promise<ContextDTO> {
    const row = await super._createContext(input);
    return rowToContextDTO(row);
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDTO> {
    const row = await super._updateContext(id, input);
    return rowToContextDTO(row);
  }

  async listTrashedContexts(): Promise<TrashedContextDTO[]> {
    return this.listTrashedContextRows();
  }
}
