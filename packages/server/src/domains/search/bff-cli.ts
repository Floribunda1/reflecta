import { inArray } from "drizzle-orm";
import { understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { SearchCore } from "./core";
import { toUnderstandingSummaries } from "../understanding/core";
import type { ContextMedium } from "../context/types";
import type { SearchHit, SearchOptions, SearchOutput } from "./types";

export class SearchCliBff extends SearchCore {
  constructor(db: ReflectaDb) {
    super(db);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchOutput> {
    const retrievalHits = await this.searchRetrievalDocuments(query, options);
    const understandingIds = [
      ...new Set(
        retrievalHits
          .filter((hit) => hit.entityType === "understanding")
          .map((hit) => hit.entityId),
      ),
    ];
    const understandingRows =
      understandingIds.length === 0
        ? []
        : await this.db
            .select()
            .from(understandings)
            .where(inArray(understandings.id, understandingIds));
    const summaries = await toUnderstandingSummaries(this.db, understandingRows);
    const summaryMap = new Map(summaries.map((summary) => [summary.id, summary]));

    const hits: SearchHit[] = [];
    for (const hit of retrievalHits) {
      if (hit.entityType === "context") {
        hits.push({
          type: "context",
          context: {
            id: hit.entityId,
            understandingId: hit.parentUnderstandingId,
            medium: hit.metadata.medium as ContextMedium,
            title: hit.metadata.title ?? null,
          },
          understandingId: hit.parentUnderstandingId,
          matchedText: hit.snippet,
          rank: hit.rank,
        });
        continue;
      }

      const summary = summaryMap.get(hit.entityId);
      if (!summary) continue;
      hits.push({
        type: "understanding",
        understanding: {
          id: summary.id,
          title: summary.title,
          body: summary.body,
          domains: summary.domains,
        },
        matchedText: hit.snippet,
        rank: hit.rank,
      });
    }

    return { hits };
  }
}
