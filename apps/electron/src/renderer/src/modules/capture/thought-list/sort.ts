import type { ThoughtSummaryDTO } from "@shared/thought";

export type ThoughtListSortBy = "updatedAt" | "createdAt";

export function sortThoughtSummaries(
  thoughts: ThoughtSummaryDTO[],
  sortBy: ThoughtListSortBy,
): ThoughtSummaryDTO[] {
  return [...thoughts].sort((left, right) => right[sortBy].localeCompare(left[sortBy]));
}
