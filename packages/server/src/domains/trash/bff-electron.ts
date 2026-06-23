import { isNotNull } from "drizzle-orm";
import { understandings } from "../../db/schema";
import type { TrashedUnderstandingDTO } from "./types";
import type { ReflectaServerContext } from "../shared/types-electron";

export class TrashElectronBff {
  constructor(private readonly options: ReflectaServerContext) {}

  async listTrashedUnderstandings(): Promise<TrashedUnderstandingDTO[]> {
    const db = this.options.getDb();
    const rows = await db.select().from(understandings).where(isNotNull(understandings.deletedAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? null,
      body: r.body,
      deletedAt: r.deletedAt!,
    }));
  }
}
