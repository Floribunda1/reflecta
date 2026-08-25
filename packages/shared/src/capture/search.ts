/**
 * search 域 wire format（Effect Schema 单一真源）。
 * server types 与 electron ipc/contract 都从这里派生，不再各自定义。
 */
import * as S from "effect/Schema";
import { UnderstandingSummaryDTO } from "./understanding";

export const SearchOptions = S.Struct({
  limit: S.optional(S.Number),
  offset: S.optional(S.Number),
});
export type SearchOptions = S.Schema.Type<typeof SearchOptions>;

export const SearchContextResult = S.Struct({
  contextId: S.String,
  understandingId: S.String,
  title: S.NullOr(S.String),
  snippet: S.String,
  rank: S.Number,
});
export type SearchContextResult = S.Schema.Type<typeof SearchContextResult>;

export const SearchResult = S.Struct({
  understandings: S.mutable(S.Array(UnderstandingSummaryDTO)),
  contexts: S.mutable(S.Array(SearchContextResult)),
});
export type SearchResult = S.Schema.Type<typeof SearchResult>;
