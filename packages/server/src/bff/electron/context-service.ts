import {
  createContext as coreCreateContext,
  deleteContext as coreDeleteContext,
  listContextRows,
  listTrashedContextRows,
  permanentlyDeleteContext as corePermanentlyDeleteContext,
  restoreContext as coreRestoreContext,
  updateContext as coreUpdateContext,
} from "../core/context-core";
import type {
  ContextDTO,
  CreateContextInput,
  TrashedContextDTO,
  UpdateContextInput,
} from "../../types";
import { rowToContextDTO } from "./shared";
import type { ReflectaServerContext } from "./types";

export class ContextService {
  constructor(private readonly options: ReflectaServerContext) {}

  async listContextsByThought(thoughtId: string): Promise<ContextDTO[]> {
    const rows = await listContextRows(this.options.getDb(), thoughtId);
    return rows.map(rowToContextDTO);
  }

  async createContext(input: CreateContextInput): Promise<ContextDTO> {
    const row = await coreCreateContext(this.options.getDb(), input);
    return rowToContextDTO(row);
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDTO> {
    const row = await coreUpdateContext(this.options.getDb(), id, input);
    return rowToContextDTO(row);
  }

  async deleteContext(id: string): Promise<void> {
    await coreDeleteContext(this.options.getDb(), id);
  }

  async restoreContext(id: string): Promise<void> {
    await coreRestoreContext(this.options.getDb(), id);
  }

  async permanentlyDeleteContext(id: string): Promise<void> {
    await corePermanentlyDeleteContext(this.options.getDb(), id);
  }

  async listTrashedContexts(): Promise<TrashedContextDTO[]> {
    return listTrashedContextRows(this.options.getDb());
  }
}
