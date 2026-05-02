import type { ContextDTO, CreateContextInput, UpdateContextInput } from "./types";
import { ContextCore } from "./core";
import type { ReflectaServerContext } from "../shared/types-electron";

export class ContextElectronBff extends ContextCore {
  constructor(options: ReflectaServerContext) {
    super(options.getDb());
  }

  async createContext(input: CreateContextInput): Promise<ContextDTO> {
    return super._createContext(input);
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDTO> {
    return super._updateContext(id, input);
  }
}
