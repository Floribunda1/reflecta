// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import type { AgentSessionSummary } from "@shared/agent";
import { buildContextualAgentHistoryItems } from "./contextual-agent-dock";

function thread(id: string): AgentSessionSummary {
  return {
    id,
    title: `Thread ${id}`,
    status: "active",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    runtime: "pi",
  };
}

describe("buildContextualAgentHistoryItems", () => {
  test("shows recent threads without scope filtering and caps at 10", () => {
    const items = buildContextualAgentHistoryItems(
      Array.from({ length: 12 }, (_, index) => thread(String(index + 1))),
      "2",
    );

    expect(items.map((item) => item.id)).toEqual([
      "1",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
    ]);
  });
});
