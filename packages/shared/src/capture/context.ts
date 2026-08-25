/**
 * context 域 wire format（Effect Schema 单一真源）。
 * server types 与 electron ipc/contract 都从这里派生，不再各自定义。
 */
import * as S from "effect/Schema";

const lit = <T extends string>(...xs: T[]) => S.Union(xs.map((x) => S.Literal(x)));

export const ContextMediumSchema = lit(
  "experience",
  "video",
  "book",
  "article",
  "opinion",
  "ai",
  "other",
);
export type ContextMedium = S.Schema.Type<typeof ContextMediumSchema>;

export const ContextDTO = S.Struct({
  id: S.String,
  understandingId: S.String,
  medium: ContextMediumSchema,
  title: S.NullOr(S.String),
  content: S.String,
  createdAt: S.String,
  deletedAt: S.NullOr(S.String),
});
export type ContextDTO = S.Schema.Type<typeof ContextDTO>;

export const CreateContextInput = S.Struct({
  understandingId: S.String,
  medium: ContextMediumSchema,
  title: S.optional(S.String),
  content: S.String,
});
export type CreateContextInput = S.Schema.Type<typeof CreateContextInput>;

export const UpdateContextInput = S.Struct({
  understandingId: S.optional(S.String),
  medium: S.optional(ContextMediumSchema),
  title: S.optional(S.String),
  content: S.optional(S.String),
});
export type UpdateContextInput = S.Schema.Type<typeof UpdateContextInput>;

export const TrashedContextDTO = S.Struct({
  id: S.String,
  understandingId: S.String,
  understandingTitle: S.NullOr(S.String),
  medium: ContextMediumSchema,
  title: S.NullOr(S.String),
  content: S.String,
  deletedAt: S.String,
});
export type TrashedContextDTO = S.Schema.Type<typeof TrashedContextDTO>;
