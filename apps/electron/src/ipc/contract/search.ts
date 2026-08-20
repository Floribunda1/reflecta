/** search 域契约（迁移批 Round B）。注：retrieveKnowledge 仅 agent 经 CLI bff 用，renderer 未走 IPC，删除。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";

export class SearchError extends S.TaggedError<SearchError>()("SearchError", {
  reason: S.String,
  code: S.Number,
}) {}

export const UnderstandingSummaryDTO = S.Struct({
  id: S.String,
  title: S.NullOr(S.String),
  body: S.String,
  domainIds: S.Array(S.String),
  contextCount: S.Number,
  mentionCount: S.Number,
  mentionIds: S.Array(S.String),
  createdAt: S.String,
  updatedAt: S.String,
});
export type UnderstandingSummaryDTO = S.Schema.Type<typeof UnderstandingSummaryDTO>;

export const SearchContextResult = S.Struct({
  contextId: S.String,
  understandingId: S.String,
  title: S.NullOr(S.String),
  snippet: S.String,
  rank: S.Number,
});
export type SearchContextResult = S.Schema.Type<typeof SearchContextResult>;

export const SearchResult = S.Struct({
  understandings: S.Array(UnderstandingSummaryDTO),
  contexts: S.Array(SearchContextResult),
});
export type SearchResult = S.Schema.Type<typeof SearchResult>;

export const SearchOptions = S.Struct({
  limit: S.optional(S.Number),
  offset: S.optional(S.Number),
});

export const SearchUnderstandings = rpc(
  "search.searchUnderstandings",
  S.Struct({ query: S.String, options: S.optional(SearchOptions) }),
  S.Array(UnderstandingSummaryDTO),
  SearchError,
);
export const SearchContexts = rpc(
  "search.searchContexts",
  S.Struct({ query: S.String, options: S.optional(SearchOptions) }),
  S.Array(SearchContextResult),
  SearchError,
);
export const SearchSearch = rpc(
  "search.search",
  S.Struct({ query: S.String, options: S.optional(SearchOptions) }),
  SearchResult,
  SearchError,
);
