import { expect, test } from "@playwright/test";
import { launchApp } from "../acceptance/spec/agent/agent-e2e";
import { openCapturePage } from "../acceptance/spec/capture/capture-e2e";

test("Understanding list scrollbar stays flush with the divider", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    const listPanel = page.getByTestId("capture-understanding-list-panel");
    const viewportBox = await listPanel.locator(".overflow-y-auto").boundingBox();
    const handleBox = await page
      .getByTestId("capture-understanding-list-resize-handle")
      .boundingBox();
    if (!viewportBox || !handleBox) throw new Error("Understanding list layout is not visible");

    expect(handleBox.x + handleBox.width - viewportBox.x - viewportBox.width).toBeLessThanOrEqual(
      1,
    );
  } finally {
    await app.close();
  }
});
