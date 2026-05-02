import {
  createContext as coreCreateContext,
  deleteContext as coreDeleteContext,
  getContextRow,
  listContextRows,
  updateContext as coreUpdateContext,
} from "../core/context-core";
import type { ReflectaDb } from "../../db/types";
import type { ContextDetail, CreateContextInput, SourceType, UpdateContextInput } from "./types";

export class ContextService {
  constructor(private db: ReflectaDb) {}

  async listContexts(thoughtId: string): Promise<ContextDetail[]> {
    const rows = await listContextRows(this.db, thoughtId);
    return rows.map((r) => ({
      id: r.id,
      thoughtId: r.thoughtId,
      sourceType: r.sourceType as SourceType,
      sourceName: r.sourceName ?? null,
      content: r.content,
    }));
  }

  async getContext(id: string): Promise<ContextDetail> {
    const row = await getContextRow(this.db, id);
    if (!row) {
      throw new Error(`Context not found: ${id}`);
    }

    return {
      id: row.id,
      thoughtId: row.thoughtId,
      sourceType: row.sourceType as SourceType,
      sourceName: row.sourceName ?? null,
      content: row.content,
    };
  }

  async createContext(input: CreateContextInput): Promise<ContextDetail> {
    const row = await coreCreateContext(this.db, input);
    return {
      id: row.id,
      thoughtId: row.thoughtId,
      sourceType: row.sourceType as SourceType,
      sourceName: row.sourceName ?? null,
      content: row.content,
    };
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDetail> {
    const row = await coreUpdateContext(this.db, id, input);
    return {
      id: row.id,
      thoughtId: row.thoughtId,
      sourceType: row.sourceType as SourceType,
      sourceName: row.sourceName ?? null,
      content: row.content,
    };
  }

  async deleteContext(id: string): Promise<void> {
    await coreDeleteContext(this.db, id);
  }
}
