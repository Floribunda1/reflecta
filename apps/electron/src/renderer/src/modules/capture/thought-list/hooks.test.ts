// @vitest-environment happy-dom

import type { ThoughtSummaryDTO } from "@shared/thought";
import { describe, expect, test } from "vitest";
import { orderThoughtsForStableList } from "./hooks";

function thought(partial: Partial<ThoughtSummaryDTO> & { id: string }): ThoughtSummaryDTO {
  return {
    id: partial.id,
    type: partial.type ?? "insight",
    title: partial.title ?? partial.id,
    body: partial.body ?? "",
    categoryIds: partial.categoryIds ?? [],
    contextCount: partial.contextCount ?? 0,
    connectionCount: partial.connectionCount ?? 0,
    connectionIds: partial.connectionIds ?? [],
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("orderThoughtsForStableList", () => {
  test("sorts by updated time when there is no previous list order", () => {
    const ordered = orderThoughtsForStableList([
      thought({ id: "older", updatedAt: "2026-01-01T00:00:00.000Z" }),
      thought({ id: "newer", updatedAt: "2026-01-02T00:00:00.000Z" }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["newer", "older"]);
  });

  test("keeps existing rows in their previous order when updatedAt changes", () => {
    const ordered = orderThoughtsForStableList(
      [
        thought({ id: "a", updatedAt: "2026-01-03T00:00:00.000Z" }),
        thought({ id: "b", updatedAt: "2026-01-02T00:00:00.000Z" }),
        thought({ id: "c", updatedAt: "2026-01-04T00:00:00.000Z" }),
      ],
      ["b", "a", "c"],
    );

    expect(ordered.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  test("puts newly visible rows before stable existing rows", () => {
    const ordered = orderThoughtsForStableList(
      [
        thought({ id: "a", updatedAt: "2026-01-03T00:00:00.000Z" }),
        thought({ id: "new", updatedAt: "2026-01-04T00:00:00.000Z" }),
        thought({ id: "b", updatedAt: "2026-01-02T00:00:00.000Z" }),
      ],
      ["b", "a"],
    );

    expect(ordered.map((item) => item.id)).toEqual(["new", "b", "a"]);
  });
});
