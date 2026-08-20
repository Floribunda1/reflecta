import { Effect } from "effect";
import type { ReflectaDb } from "../../db/types";
import { DomainCore, DomainNotFoundError, inspectDomainProgram } from "./core";
import type {
  DomainInspectResult,
  DomainSummary,
  CreateDomainInput,
  InspectDomainOptions,
  UpdateDomainInput,
} from "./types";
import type { RetrievalIndexUpdateSink } from "../shared/types";

export class DomainCliBff extends DomainCore {
  constructor(db: ReflectaDb, retrievalIndex?: RetrievalIndexUpdateSink) {
    super(db, retrievalIndex);
  }

  async listDomains(): Promise<DomainSummary[]> {
    const rows = await Effect.runPromise(this.listDomainRows());
    return rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parentId }));
  }

  async getDomain(id: string): Promise<DomainSummary> {
    const row = await Effect.runPromise(this.getDomainRow(id));
    if (!row) {
      // typed 域错误：runner 按 `_tag.endsWith("NotFoundError")` 映射到 NOT_FOUND。
      throw new DomainNotFoundError({ id });
    }
    return { id: row.id, name: row.name, parentId: row.parentId };
  }

  async inspectDomain(id: string, options?: InspectDomainOptions): Promise<DomainInspectResult> {
    return Effect.runPromise(inspectDomainProgram(this.db, id, options));
  }

  async createDomainSummary(input: CreateDomainInput): Promise<DomainSummary> {
    const row = await Effect.runPromise(super.createDomain(input));
    return { id: row.id, name: row.name, parentId: row.parentId };
  }

  async updateDomainSummary(id: string, input: UpdateDomainInput): Promise<DomainSummary> {
    const row = await Effect.runPromise(super.updateDomain(id, input));
    return { id: row.id, name: row.name, parentId: row.parentId };
  }
}
