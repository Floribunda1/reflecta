import { describe, expect, test } from "vitest";
import type { AgentSessionSummary } from "@shared/agent";
import { groupAgentThreads } from "./thread-groups";

function thread(id: string, updatedAt: string): AgentSessionSummary {
  return {
    id,
    title: id,
    status: "active",
    createdAt: updatedAt,
    updatedAt,
    runtime: "pi",
  };
}

describe("groupAgentThreads", () => {
  test("groups threads by recency and keeps newest first", () => {
    const now = new Date("2026-06-18T12:00:00.000Z").getTime();

    const groups = groupAgentThreads(
      [
        thread("older", "2026-05-01T00:00:00.000Z"),
        thread("today-late", "2026-06-18T11:00:00.000Z"),
        thread("today-early", "2026-06-18T01:00:00.000Z"),
        thread("yesterday", "2026-06-17T12:00:00.000Z"),
        thread("week", "2026-06-14T12:00:00.000Z"),
        thread("month", "2026-06-01T12:00:00.000Z"),
      ],
      now,
    );

    expect(groups.map((group) => group.label)).toEqual([
      "今天",
      "昨天",
      "最近 7 天",
      "最近 30 天",
      "更早",
    ]);
    expect(groups[0]?.threads.map((item) => item.id)).toEqual(["today-late", "today-early"]);
  });
});
