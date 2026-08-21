/** search 域 IPC handlers（业务在 services/core 的 searchService）。 */
import { SearchError } from "../../ipc";
import { searchService } from "../services/core";
import type { HandlerModule } from "./util";

const error = (message: string) => new SearchError({ reason: message, code: 500 });

export const search: HandlerModule = {
  domain: "search",
  error,
  handlers: {
    "search.searchUnderstandings": ({ query, options }) =>
      searchService.searchUnderstandings(
        query,
        options as import("@reflecta/server").SearchOptions | undefined,
      ),
    "search.searchContexts": ({ query, options }) =>
      searchService.searchContexts(
        query,
        options as import("@reflecta/server").SearchOptions | undefined,
      ),
    "search.search": ({ query, options }) =>
      searchService.search(query, options as import("@reflecta/server").SearchOptions | undefined),
  },
};
