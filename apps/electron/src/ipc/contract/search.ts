/** search 域契约（迁移批 Round B）。注：retrieveKnowledge 仅 agent 经 CLI bff 用，renderer 未走 IPC，删除。 */
import * as S from "effect/Schema";
import { rpc } from "electron-effect-rpc";
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
