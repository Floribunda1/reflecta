import { describe, expect, test } from "vitest";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { sortThoughtSummaries } from "./sort";

function thought(partial: Partial<ThoughtSummaryDTO> & { id: string }): ThoughtSummaryDTO {
  return {
    type: "insight",
    title: null,
    body: "",
    categoryIds: [],
    contextCount: 0,
    connectionCount: 0,
    connectionIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("sortThoughtSummaries", () => {
  test("sorts by updatedAt descending", () => {
    const sorted = sortThoughtSummaries(
      [
        thought({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
        thought({ id: "new", updatedAt: "2026-06-01T00:00:00.000Z" }),
      ],
      "updatedAt",
    );

    expect(sorted.map((item) => item.id)).toEqual(["new", "old"]);
  });

  test("sorts by createdAt descending", () => {
    const sorted = sortThoughtSummaries(
      [
        thought({
          id: "old",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        }),
        thought({
          id: "new",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      ],
      "createdAt",
    );

    expect(sorted.map((item) => item.id)).toEqual(["new", "old"]);
  });
});
