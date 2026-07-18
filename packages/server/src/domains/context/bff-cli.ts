import type { ReflectaDb } from "../../db/types";
import { ContextCore } from "./core";
import type { ContextDetail, CreateContextInput, ContextMedium, UpdateContextInput } from "./types";
import type { RetrievalIndexUpdateSink } from "../shared/types";

export class ContextCliBff extends ContextCore {
  constructor(db: ReflectaDb, retrievalIndex?: RetrievalIndexUpdateSink) {
    super(db, retrievalIndex);
  }

  async listContexts(understandingId: string): Promise<ContextDetail[]> {
    const rows = await this.listContextsByUnderstanding(understandingId);
    return rows.map((r) => ({
      id: r.id,
      understandingId: r.understandingId,
      medium: r.medium,
      title: r.title,
      content: r.content,
    }));
  }

  async getContext(id: string): Promise<ContextDetail> {
    const row = await this.getContextRow(id);
    if (!row) {
      throw new Error(`Context not found: ${id}`);
    }

    return {
      id: row.id,
      understandingId: row.understandingId,
      medium: row.medium as ContextMedium,
      title: row.title ?? null,
      content: row.content,
    };
  }

  async createContext(input: CreateContextInput): Promise<ContextDetail> {
    const row = await super._createContext(input);
    return {
      id: row.id,
      understandingId: row.understandingId,
      medium: row.medium,
      title: row.title,
      content: row.content,
    };
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDetail> {
    const row = await super._updateContext(id, input);
    return {
      id: row.id,
      understandingId: row.understandingId,
      medium: row.medium,
      title: row.title,
      content: row.content,
    };
  }
}
