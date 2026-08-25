import { Effect } from "effect";
import * as S from "effect/Schema";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { contexts, understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import type { ContextDTO, CreateContextInput, ContextMedium, UpdateContextInput } from "./types";
import type { TrashedContextDTO } from "../trash/types";
import { createEntityId } from "@reflecta/shared";
import type { RetrievalIndexUpdateSink } from "../shared/types";

export class ContextNotFoundError extends S.TaggedError<ContextNotFoundError>()(
  "ContextNotFoundError",
  { id: S.String },
) {}
export class NoContextFieldsError extends S.TaggedError<NoContextFieldsError>()(
  "NoContextFieldsError",
  { message: S.String },
) {}
export class ContextUnderstandingNotFoundError extends S.TaggedError<ContextUnderstandingNotFoundError>()(
  "ContextUnderstandingNotFoundError",
  { understandingId: S.String },
) {}

export type ContextError =
  | ContextNotFoundError
  | NoContextFieldsError
  | ContextUnderstandingNotFoundError;

export class ContextCore {
  constructor(
    protected db: ReflectaDb,
    private readonly retrievalIndex?: RetrievalIndexUpdateSink,
  ) {}

  listContextsByUnderstanding(understandingId: string): Effect.Effect<ContextDTO[]> {
    return Effect.promise(async () => {
      const rows = await this.db
        .select()
        .from(contexts)
        .where(and(eq(contexts.understandingId, understandingId), isNull(contexts.deletedAt)))
        .orderBy(desc(contexts.createdAt));
      return rows as ContextDTO[];
    });
  }

  getContextRow(id: string): Effect.Effect<typeof contexts.$inferSelect | null> {
    return Effect.promise(async () => {
      const rows = await this.db
        .select()
        .from(contexts)
        .where(and(eq(contexts.id, id), isNull(contexts.deletedAt)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  _createContext(input: CreateContextInput): Effect.Effect<ContextDTO, ContextError> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    const assertUnderstandingExists = this.assertUnderstandingExists.bind(this);
    return Effect.gen(function* () {
      const createdAt = new Date().toISOString();
      const id = createEntityId();
      yield* assertUnderstandingExists(input.understandingId);

      const row: typeof contexts.$inferInsert = {
        id,
        understandingId: input.understandingId,
        medium: input.medium,
        title: input.title ?? null,
        content: input.content,
        createdAt,
        deletedAt: null,
      };

      yield* Effect.sync(() => db.insert(contexts).values(row).run());
      retrievalIndex?.enqueue([input.understandingId]);
      return { ...row, createdAt, deletedAt: null } as ContextDTO;
    });
  }

  _updateContext(id: string, input: UpdateContextInput): Effect.Effect<ContextDTO, ContextError> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    const getContextRow = this.getContextRow.bind(this);
    const assertUnderstandingExists = this.assertUnderstandingExists.bind(this);
    return Effect.gen(function* () {
      const updates: Partial<typeof contexts.$inferInsert> = {};
      let previousUnderstandingId: string | undefined;
      if (input.understandingId !== undefined) {
        const current = yield* getContextRow(id);
        if (!current) return yield* Effect.fail(new ContextNotFoundError({ id }));
        yield* assertUnderstandingExists(input.understandingId);
        previousUnderstandingId = current.understandingId;
        updates.understandingId = input.understandingId;
      }
      if (input.medium !== undefined) updates.medium = input.medium;
      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) updates.content = input.content;
      if (Object.keys(updates).length === 0) {
        return yield* Effect.fail(
          new NoContextFieldsError({ message: "No context fields to update" }),
        );
      }

      const rows: Array<typeof contexts.$inferSelect> = yield* Effect.promise(async () =>
        db.transaction((tx) =>
          tx.update(contexts).set(updates).where(eq(contexts.id, id)).returning().all(),
        ),
      );
      if (rows.length === 0) return yield* Effect.fail(new ContextNotFoundError({ id }));
      const updated = rows[0] as ContextDTO;

      retrievalIndex?.enqueue(
        previousUnderstandingId
          ? [previousUnderstandingId, updated.understandingId]
          : [updated.understandingId],
      );
      return updated;
    });
  }

  deleteContext(id: string): Effect.Effect<void, ContextError> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    return Effect.gen(function* () {
      const rows: Array<typeof contexts.$inferSelect> = yield* Effect.promise(async () =>
        db.transaction((tx) =>
          tx
            .update(contexts)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(contexts.id, id))
            .returning()
            .all(),
        ),
      );
      if (rows.length === 0) return yield* Effect.fail(new ContextNotFoundError({ id }));
      retrievalIndex?.enqueue([rows[0].understandingId]);
    });
  }

  restoreContext(id: string): Effect.Effect<void> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    return Effect.gen(function* () {
      const rows: Array<typeof contexts.$inferSelect> = yield* Effect.promise(async () =>
        db.transaction((tx) =>
          tx
            .update(contexts)
            .set({ deletedAt: null })
            .where(and(eq(contexts.id, id), isNotNull(contexts.deletedAt)))
            .returning()
            .all(),
        ),
      );
      if (rows[0]) retrievalIndex?.enqueue([rows[0].understandingId]);
    });
  }

  permanentlyDeleteContext(id: string): Effect.Effect<void> {
    const db = this.db;
    const retrievalIndex = this.retrievalIndex;
    return Effect.gen(function* () {
      const rows = yield* Effect.sync(() =>
        db.delete(contexts).where(eq(contexts.id, id)).returning().all(),
      );
      if (rows[0]) retrievalIndex?.enqueue([rows[0].understandingId]);
    });
  }

  private assertUnderstandingExists(understandingId: string): Effect.Effect<void, ContextError> {
    const db = this.db;
    return Effect.gen(function* () {
      const rows = yield* Effect.promise(() =>
        db
          .select({ id: understandings.id })
          .from(understandings)
          .where(and(eq(understandings.id, understandingId), isNull(understandings.deletedAt)))
          .limit(1),
      );
      // 失败走 typed error 通道（Effect.promise 内 throw 会变成 defect，无法 catchTag/retry）。
      if (rows.length === 0) {
        return yield* Effect.fail(new ContextUnderstandingNotFoundError({ understandingId }));
      }
    });
  }

  listTrashedContexts(): Effect.Effect<TrashedContextDTO[]> {
    const db = this.db;
    return Effect.promise(async () => {
      const rows = await db.all<{
        id: string;
        understanding_id: string;
        understanding_title: string | null;
        medium: string;
        title: string | null;
        content: string;
        deleted_at: string;
      }>(sql`
        SELECT
          c.id,
          c.understanding_id,
          t.title AS understanding_title,
          c.medium,
          c.title,
          c.content,
          c.deleted_at
        FROM contexts c
        JOIN understandings t ON t.id = c.understanding_id
        WHERE c.deleted_at IS NOT NULL
          AND t.deleted_at IS NULL
        ORDER BY c.deleted_at DESC
      `);

      return rows.map((r) => ({
        id: r.id,
        understandingId: r.understanding_id,
        understandingTitle: r.understanding_title ?? null,
        medium: r.medium as ContextMedium,
        title: r.title ?? null,
        content: r.content,
        deletedAt: r.deleted_at,
      }));
    });
  }
}
