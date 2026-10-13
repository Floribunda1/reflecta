/** search 域契约（迁移批 Round B）。注：retrieveKnowledge 仅 agent 经 CLI bff 用，renderer 未走 IPC，删除。 */
import * as S from "effect/Schema";
import { Rpc } from "effect/rpc";
import {
  UnderstandingSummaryDTO,
  SearchContextResult,
  SearchResult,
  SearchOptions,
} from "@reflecta/shared";

export class SearchError extends S.TaggedError<SearchError>()("SearchError", {
  reason: S.String,
  code: S.Number,
}) {}

export const SearchUnderstandings = Rpc.make("search.searchUnderstandings", {
  payload: S.Struct({ query: S.String, options: S.optional(SearchOptions) }),
  success: S.Array(UnderstandingSummaryDTO),
  error: SearchError,
});
export const SearchContexts = Rpc.make("search.searchContexts", {
  payload: S.Struct({ query: S.String, options: S.optional(SearchOptions) }),
  success: S.Array(SearchContextResult),
  error: SearchError,
});
export const SearchSearch = Rpc.make("search.search", {
  payload: S.Struct({ query: S.String, options: S.optional(SearchOptions) }),
  success: SearchResult,
  error: SearchError,
});
