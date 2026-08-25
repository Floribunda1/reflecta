/**
 * understanding 域 wire format（Effect Schema 单一真源）。
 * server types 与 electron ipc/contract 都从这里派生，不再各自定义。
 */
import * as S from "effect/Schema";
import { ContextDTO } from "./context";

export const UnderstandingSummaryDTO = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  body: S.String,
  domainIds: S.mutable(S.Array(S.String)),
  contextCount: S.Number,
  mentionCount: S.Number,
  mentionIds: S.mutable(S.Array(S.String)),
  createdAt: S.String,
  updatedAt: S.String,
});
export type UnderstandingSummaryDTO = S.Schema.Type<typeof UnderstandingSummaryDTO>;

export const UnderstandingDTO = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  body: S.String,
  domainIds: S.mutable(S.Array(S.String)),
  contexts: S.mutable(S.Array(ContextDTO)),
  mentions: S.mutable(S.Array(UnderstandingSummaryDTO)),
  referencedBy: S.mutable(S.Array(UnderstandingSummaryDTO)),
  createdAt: S.String,
  updatedAt: S.String,
});
export type UnderstandingDTO = S.Schema.Type<typeof UnderstandingDTO>;

export const CreateUnderstandingInput = S.Struct({
  title: S.optional(S.String),
  body: S.optional(S.String),
  domainIds: S.optional(S.mutable(S.Array(S.String))),
});
export type CreateUnderstandingInput = S.Schema.Type<typeof CreateUnderstandingInput>;

export const UpdateUnderstandingInput = S.Struct({
  title: S.optional(S.NullOr(S.String)),
  body: S.optional(S.String),
  domainIds: S.optional(S.mutable(S.Array(S.String))),
});
export type UpdateUnderstandingInput = S.Schema.Type<typeof UpdateUnderstandingInput>;

export const ListUnderstandingsFilter = S.Struct({
  domainIds: S.optional(S.mutable(S.Array(S.String))),
  includeDescendants: S.optional(S.Boolean),
  searchQuery: S.optional(S.String),
  limit: S.optional(S.Number),
  offset: S.optional(S.Number),
});
export type ListUnderstandingsFilter = S.Schema.Type<typeof ListUnderstandingsFilter>;
