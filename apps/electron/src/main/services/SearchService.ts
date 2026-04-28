import type {
  FtsContextResult,
  SearchOptions,
  SearchResult,
  ThoughtSummaryDTO,
} from "@reflecta/server";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { searchService } from "./core";

export class SearchService extends IpcService {
  static readonly groupName = "search";

  @IpcMethod()
  async searchThoughts(query: string, options?: SearchOptions): Promise<ThoughtSummaryDTO[]> {
    return searchService.searchThoughts(query, options);
  }

  @IpcMethod()
  async searchContexts(query: string, options?: SearchOptions): Promise<FtsContextResult[]> {
    return searchService.searchContexts(query, options);
  }

  @IpcMethod()
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    return searchService.search(query, options);
  }
}
