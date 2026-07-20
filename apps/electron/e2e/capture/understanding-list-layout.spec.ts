import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { openCapturePage } from "./capture-e2e";

test("@CP-LIST-001 用户调整 Understanding 列表宽度", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    const listPanel = page.getByTestId("capture-understanding-list-panel");
    const detailPanel = page.getByTestId("capture-understanding-detail-panel");
    const handleBox = await page
      .getByTestId("capture-understanding-list-resize-handle")
      .boundingBox();
    const initialBox = await listPanel.boundingBox();
    if (!handleBox || !initialBox)
      throw new Error("Understanding list resize handle is not visible");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2, { steps: 8 });
    await expect
      .poll(async () => (await listPanel.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialBox.width + 70);
    await page.mouse.up();
    await expect(detailPanel).toBeVisible();
  } finally {
    await page.mouse.up().catch(() => undefined);
    await app.close();
  }
});
