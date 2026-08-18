import { expect, test } from "@playwright/test";
import { launchAgentPage } from "../../acceptance/spec/agent/agent-e2e";

test("agent page top bar keeps the unused title area draggable", async () => {
  const { app, page } = await launchAgentPage();

  try {
    const header = page.getByTestId("agent-thread-chat").locator("header");
    await expect(header).toBeVisible();

    const regions = await header.evaluate((element) => {
      const title = element.querySelector<HTMLElement>('[data-testid="agent-thread-title"]');
      const actions = element.lastElementChild;
      const titleRegion = title?.closest<HTMLElement>("[data-no-drag]");
      if (!title || !titleRegion || !actions)
        throw new Error("Agent top bar regions are not rendered");

      const headerBox = element.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      const actionsBox = actions.getBoundingClientRect();
      const gap = actionsBox.left - titleBox.right;
      const point = element.ownerDocument.elementFromPoint(
        titleBox.right + gap / 2,
        headerBox.top + headerBox.height / 2,
      );

      return {
        gap,
        blankRegion: point ? getComputedStyle(point).webkitAppRegion : null,
        titleRegion: getComputedStyle(titleRegion).webkitAppRegion,
        actionsRegion: getComputedStyle(actions).webkitAppRegion,
      };
    });

    expect(regions.gap).toBeGreaterThan(8);
    expect(regions.blankRegion).toBe("drag");
    expect(regions.titleRegion).toBe("no-drag");
    expect(regions.actionsRegion).toBe("no-drag");
  } finally {
    await app.close();
  }
});
