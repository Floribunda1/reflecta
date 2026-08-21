import type { UnderstandingSummaryDTO } from "@shared/understanding";

export type UnderstandingListSortBy = "updatedAt" | "createdAt";

export function sortUnderstandingSummaries(
  understandings: readonly UnderstandingSummaryDTO[],
  sortBy: UnderstandingListSortBy,
): UnderstandingSummaryDTO[] {
  return understandings.toSorted(
    (left, right) => right[sortBy].localeCompare(left[sortBy]) || left.id.localeCompare(right.id),
  );
}
