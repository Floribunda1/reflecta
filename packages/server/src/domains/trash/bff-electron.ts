import { isNotNull } from "drizzle-orm";
import { thoughts } from "../../db/schema";
import type { TrashedThoughtDTO } from "./types";
import type { ReflectaServerContext } from "../shared/types-electron";

export class TrashElectronBff {
  constructor(private readonly options: ReflectaServerContext) {}

  async listTrashedThoughts(): Promise<TrashedThoughtDTO[]> {
    const db = this.options.getDb();
    const rows = await db.select().from(thoughts).where(isNotNull(thoughts.deletedAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? null,
      body: r.body,
      deletedAt: r.deletedAt!,
    }));
  }
}
