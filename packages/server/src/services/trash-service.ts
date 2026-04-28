import { isNotNull } from "drizzle-orm";
import { thoughts } from "../db/schema.js";
import type { TrashedThoughtDTO, ThoughtType } from "../types.js";
import type { ReflectaServerContext } from "./types.js";

export class TrashService {
  constructor(private readonly options: ReflectaServerContext) {}

  async listTrashedThoughts(): Promise<TrashedThoughtDTO[]> {
    const db = this.options.getDb();
    const rows = await db.select().from(thoughts).where(isNotNull(thoughts.deletedAt));
    return rows.map((r) => ({
      id: r.id,
      type: r.type as ThoughtType,
      title: r.title ?? null,
      body: r.body,
      deletedAt: r.deletedAt!,
    }));
  }
}
