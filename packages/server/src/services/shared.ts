import type { ContextDTO, SearchOptions, SourceType } from "../types.js";
import { contexts } from "../db/schema.js";

export function rowToContextDTO(row: typeof contexts.$inferSelect): ContextDTO {
  return {
    id: row.id,
    thoughtId: row.thoughtId,
    sourceType: row.sourceType as SourceType,
    sourceName: row.sourceName ?? null,
    content: row.content,
    createdAt: row.createdAt,
  };
}

export function getLimitOffset(options?: SearchOptions) {
  return {
    limit: options?.limit ?? 20,
    offset: options?.offset ?? 0,
  };
}
