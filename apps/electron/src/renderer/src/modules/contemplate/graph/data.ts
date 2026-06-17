import type { ThoughtSummaryDTO } from "@shared/thought";
import type { GraphStatusFilter } from "../context";

export function filterThoughtsByStatus(
  items: ThoughtSummaryDTO[],
  statusFilter: GraphStatusFilter,
): ThoughtSummaryDTO[] {
  if (statusFilter === "all" || items.length === 0) return items;

  return items.filter((thought) => {
    switch (statusFilter) {
      case "with-context":
        return thought.contextCount > 0;
      case "without-context":
        return thought.contextCount === 0;
    }
  });
}
