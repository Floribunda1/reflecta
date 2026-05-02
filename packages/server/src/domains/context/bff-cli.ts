import type { ReflectaDb } from "../../db/types";
import { ContextCore } from "./core";
import type {
  ContextDetail,
  CreateContextInput,
  SourceType,
  UpdateContextInput,
} from "../shared/types-cli";

export class ContextCliBff extends ContextCore {
  constructor(db: ReflectaDb) {
    super(db);
  }

  async listContexts(thoughtId: string): Promise<ContextDetail[]> {
    const rows = await this.listContextRows(thoughtId);
    return rows.map((r) => ({
      id: r.id,
      thoughtId: r.thoughtId,
      sourceType: r.sourceType as SourceType,
      sourceName: r.sourceName ?? null,
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
      thoughtId: row.thoughtId,
      sourceType: row.sourceType as SourceType,
      sourceName: row.sourceName ?? null,
      content: row.content,
    };
  }

  async createContext(input: CreateContextInput): Promise<ContextDetail> {
    const row = await super._createContext(input);
    return {
      id: row.id,
      thoughtId: row.thoughtId,
      sourceType: row.sourceType as SourceType,
      sourceName: row.sourceName ?? null,
      content: row.content,
    };
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDetail> {
    const row = await super._updateContext(id, input);
    return {
      id: row.id,
      thoughtId: row.thoughtId,
      sourceType: row.sourceType as SourceType,
      sourceName: row.sourceName ?? null,
      content: row.content,
    };
  }
}
