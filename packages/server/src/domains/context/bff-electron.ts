import type { ContextDTO, CreateContextInput, UpdateContextInput } from "./types";
import { ContextCore } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class ContextElectronBff extends ContextCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb(), options.retrievalIndex);
  }

  async createContext(input: CreateContextInput): Promise<ContextDTO> {
    return super._createContext(input);
  }

  async getContextById(id: string): Promise<ContextDTO | null> {
    const row = await this.getContextRow(id);
    return row as ContextDTO | null;
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDTO> {
    return super._updateContext(id, input);
  }
}
