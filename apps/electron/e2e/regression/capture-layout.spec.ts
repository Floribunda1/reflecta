import { expect, test } from "@playwright/test";
import { launchApp } from "../acceptance/spec/agent/agent-e2e";
import { openCapturePage } from "../acceptance/spec/capture/capture-e2e";

test("Understanding list scrollbar stays flush with the divider", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    const listPanel = page.getByTestId("capture-understanding-list-panel");
    // 理解列表用 shadcn ScrollArea（overlay scrollbar），滚动区是 viewport 而非 .overflow-y-auto。
    const viewportBox = await listPanel.locator('[data-slot="scroll-area-viewport"]').boundingBox();
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
