import type {
  SearchOptions,
  SearchContextResult,
  SearchResult,
  UnderstandingSummaryDTO,
} from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { searchService } from "./core";

export class SearchService extends IpcService {
  static readonly groupName = "search";

  @IpcMethod()
  async searchUnderstandings(
    query: string,
    options?: SearchOptions,
  ): Promise<UnderstandingSummaryDTO[]> {
    return searchService.searchUnderstandings(query, options);
  }

  @IpcMethod()
  async searchContexts(query: string, options?: SearchOptions): Promise<SearchContextResult[]> {
    return searchService.searchContexts(query, options);
  }

  @IpcMethod()
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    return searchService.search(query, options);
  }
}
