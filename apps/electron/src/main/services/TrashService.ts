import { getDBInstance } from "@main/db";
import { thoughts } from "@main/db/schema";
import type { TrashedThoughtDTO } from "@shared/trash";
import { eq, isNotNull, sql } from "drizzle-orm";
import { IpcMethod, IpcService } from "electron-ipc-decorator";

export class TrashService extends IpcService {
  static readonly groupName = "trash";

  /** List all soft-deleted thoughts. */
  @IpcMethod()
  async listTrashedThoughts(): Promise<TrashedThoughtDTO[]> {
    const db = getDBInstance();
    const rows = await db.select().from(thoughts).where(isNotNull(thoughts.deletedAt));
    return rows.map((r) => ({
      id: r.id,
      type: r.type as TrashedThoughtDTO["type"],
      title: r.title ?? null,
      body: r.body,
      deletedAt: r.deletedAt!,
    }));
  }

  /** Restore a soft-deleted thought. Delegates FTS re-indexing to ThoughtService logic. */
  @IpcMethod()
  async restoreThought(id: string): Promise<void> {
    const db = getDBInstance();
    const { contexts } = await import("@main/db/schema");
    await db.transaction(async (tx) => {
      const rows = await tx
        .update(thoughts)
        .set({ deletedAt: null })
        .where(eq(thoughts.id, id))
        .returning();
      if (rows.length === 0) return;
      const row = rows[0];
      await tx.run(
        sql`INSERT OR IGNORE INTO fts_thoughts (thought_id, title, body) VALUES (${row.id}, ${row.title ?? ""}, ${row.body})`,
      );
      // Re-index non-deleted contexts
      const ctxRows = await tx.select().from(contexts).where(eq(contexts.thoughtId, id));
      for (const ctx of ctxRows.filter((c) => c.deletedAt === null)) {
        await tx.run(
          sql`INSERT OR IGNORE INTO fts_contexts (context_id, thought_id, source_name, content) VALUES (${ctx.id}, ${ctx.thoughtId}, ${ctx.sourceName}, ${ctx.content})`,
        );
      }
    });
  }

  /** Permanently delete a trashed thought and all its data. Cannot be undone. */
  @IpcMethod()
  async permanentlyDeleteThought(id: string): Promise<void> {
    const db = getDBInstance();
    await db.transaction(async (tx) => {
      await tx.run(sql`DELETE FROM fts_thoughts WHERE thought_id = ${id}`);
      await tx.run(sql`DELETE FROM fts_contexts WHERE thought_id = ${id}`);
      await tx.delete(thoughts).where(eq(thoughts.id, id));
    });
  }
}
