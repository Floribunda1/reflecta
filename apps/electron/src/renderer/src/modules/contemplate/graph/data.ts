import type { UnderstandingSummaryDTO } from "@shared/understanding";
import type { GraphStatusFilter } from "../context";

export function filterUnderstandingsByStatus(
  items: UnderstandingSummaryDTO[],
  statusFilter: GraphStatusFilter,
): UnderstandingSummaryDTO[] {
  if (statusFilter === "all" || items.length === 0) return items;

  return items.filter((understanding) => {
    switch (statusFilter) {
      case "with-context":
        return understanding.contextCount > 0;
      case "without-context":
        return understanding.contextCount === 0;
    }
  });
}
