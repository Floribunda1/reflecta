import { describe, expect, test } from "vitest";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { sortUnderstandingSummaries } from "./sort";

function understanding(
  partial: Partial<UnderstandingSummaryDTO> & { id: string },
): UnderstandingSummaryDTO {
  return {
    title: null,
    body: "",
    domainIds: [],
    contextCount: 0,
    connectionCount: 0,
    connectionIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("sortUnderstandingSummaries", () => {
  test("sorts by updatedAt descending", () => {
    const sorted = sortUnderstandingSummaries(
      [
        understanding({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
        understanding({ id: "new", updatedAt: "2026-06-01T00:00:00.000Z" }),
      ],
      "updatedAt",
    );

    expect(sorted.map((item) => item.id)).toEqual(["new", "old"]);
  });

  test("sorts by createdAt descending", () => {
    const sorted = sortUnderstandingSummaries(
      [
        understanding({
          id: "old",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        }),
        understanding({
          id: "new",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      ],
      "createdAt",
    );

    expect(sorted.map((item) => item.id)).toEqual(["new", "old"]);
  });

  test("uses the id as a stable tie-breaker", () => {
    const sameTimestamp = "2026-01-01T00:00:00.000Z";
    const summaries = [
      understanding({ id: "b", createdAt: sameTimestamp, updatedAt: sameTimestamp }),
      understanding({ id: "a", createdAt: sameTimestamp, updatedAt: sameTimestamp }),
    ];

    expect(sortUnderstandingSummaries(summaries, "updatedAt").map(({ id }) => id)).toEqual([
      "a",
      "b",
    ]);
  });
});
