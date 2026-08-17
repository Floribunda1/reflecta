import { describe, expect, test } from "vitest";
import { buildUnderstandingCardView } from "./card-view";

const understanding = {
  id: "u-1",
  title: "灌溉策略",
  body: "正文",
  domainIds: ["work", "missing"],
  contextCount: 2,
  mentionCount: 1,
  mentionIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("buildUnderstandingCardView", () => {
  test("maps known domain names and keeps card fields", () => {
    const view = buildUnderstandingCardView(
      understanding,
      new Map([
        ["work", "工作"],
        ["other", "其他"],
      ]),
    );

    expect(view).toMatchObject({
      id: "u-1",
      title: "灌溉策略",
      body: "正文",
      contextCount: 2,
      mentionCount: 1,
      domainNames: ["工作"],
    });
    expect(view.updatedLabel.length).toBeGreaterThan(0);
  });
});
