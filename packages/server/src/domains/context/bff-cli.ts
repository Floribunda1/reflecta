import { Effect } from "effect";
import type { ReflectaDb } from "../../db/types";
import { ContextCore, ContextNotFoundError } from "./core";
import type { ContextDetail } from "./types";
import type { CreateContextInput, ContextMedium, UpdateContextInput } from "@reflecta/shared";
import type { RetrievalIndexUpdateSink } from "../shared/types";

export class ContextCliBff extends ContextCore {
  constructor(db: ReflectaDb, retrievalIndex?: RetrievalIndexUpdateSink) {
    super(db, retrievalIndex);
  }

  async listContexts(understandingId: string): Promise<ContextDetail[]> {
    const rows = await Effect.runPromise(this.listContextsByUnderstanding(understandingId));
    return rows.map((r) => ({
      id: r.id,
      understandingId: r.understandingId,
      medium: r.medium,
      title: r.title,
      content: r.content,
    }));
  }

  async getContext(id: string): Promise<ContextDetail> {
    const row = await Effect.runPromise(this.getContextRow(id));
    if (!row) {
      // typed 域错误：runner 按 `_tag.endsWith("NotFoundError")` 映射到 NOT_FOUND。
      throw new ContextNotFoundError({ id });
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
    const row = await Effect.runPromise(super._createContext(input));
    return {
      id: row.id,
      understandingId: row.understandingId,
      medium: row.medium,
      title: row.title,
      content: row.content,
    };
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContextDetail> {
    const row = await Effect.runPromise(super._updateContext(id, input));
    return {
      id: row.id,
      understandingId: row.understandingId,
      medium: row.medium,
      title: row.title,
      content: row.content,
    };
  }
}
