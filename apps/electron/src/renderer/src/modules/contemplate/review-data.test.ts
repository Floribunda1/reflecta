import { describe, expect, test } from "vitest";
import type { Domain } from "@shared/domain";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { buildDomainReviewSummaries, UNASSIGNED_DOMAIN_ID } from "./review-data";

const domains = [
  { id: "ai", name: "AI", parentId: null, sortOrder: 0 },
  { id: "workflow", name: "Workflow", parentId: "ai", sortOrder: 0 },
  { id: "product", name: "产品", parentId: null, sortOrder: 1 },
] as Domain[];

function understanding(
  id: string,
  domainIds: string[],
  updatedAt: string,
): UnderstandingSummaryDTO {
  return {
    id,
    title: id,
    body: "",
    domainIds,
    contextCount: 0,
    connectionCount: 0,
    connectionIds: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("domain review summaries", () => {
  test("shows each root domain with descendant understandings and keeps unassigned knowledge visible", () => {
    const result = buildDomainReviewSummaries(domains, [
      understanding("workflow-new", ["workflow"], "2026-07-19T10:00:00.000Z"),
      understanding("cross-domain", ["ai", "product"], "2026-07-18T10:00:00.000Z"),
      understanding("unassigned", [], "2026-07-17T10:00:00.000Z"),
    ]);

    expect(result.map((summary) => summary.id)).toEqual(["ai", "product", UNASSIGNED_DOMAIN_ID]);
    expect(result[0].understandings.map((item) => item.id)).toEqual([
      "workflow-new",
      "cross-domain",
    ]);
    expect(result[1].understandings.map((item) => item.id)).toEqual(["cross-domain"]);
    expect(result[2].understandings.map((item) => item.id)).toEqual(["unassigned"]);
  });
});
