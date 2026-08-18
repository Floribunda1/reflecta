import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  dragToGraph,
  firstNodeTransform,
  graphViewportTransform,
  inGraph,
  leaveWorkspace,
  openWorkspace,
  reopenWorkspace,
  waitForCanvasSave,
} from "./canvas-e2e";

test("@CV-PERSIST-001 用户重新进入画布后文本内容完整还原", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-text", { x: 200, y: 120 });
    const textCard = inGraph(page, "canvas-text-card");
    await expect(textCard).toBeVisible({ timeout: 8000 });

    await textCard.dblclick();
    await page.getByLabel("文本卡内容").fill("TEXT_BODY");
    await page.getByLabel("文本卡内容").blur();
    await expect(textCard).toContainText("TEXT_BODY");
    await waitForCanvasSave(page);

    await leaveWorkspace(page);
    await reopenWorkspace(page);

    await expect(inGraph(page, "canvas-text-card")).toContainText("TEXT_BODY");
  } finally {
    await app.close();
  }
});

test("@CV-PERSIST-002 用户重新进入画布后元素位置还原", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-text", { x: 120, y: 100 });
    const textCard = inGraph(page, "canvas-text-card");
    await expect(textCard).toBeVisible({ timeout: 8000 });

    // 拖动卡片到新位置（基于卡片中心拖动）
    const cardBox = (await textCard.boundingBox())!;
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cardBox.x + 300, cardBox.y + 200, { steps: 8 });
    await page.mouse.up();
    await waitForCanvasSave(page);

    const movedTransform = await firstNodeTransform(page);
    expect(movedTransform).toBeTruthy();

    await leaveWorkspace(page);
    await reopenWorkspace(page);

    await expect(inGraph(page, "canvas-text-card")).toBeVisible({ timeout: 8000 });
    const restoredTransform = await firstNodeTransform(page);
    expect(restoredTransform).toBe(movedTransform);
  } finally {
    await app.close();
  }
});

test("@CV-PERSIST-003 用户重新进入画布后视口还原", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-rect", { x: 200, y: 120 });
    await expect(inGraph(page, "canvas-shape-card")).toBeVisible({ timeout: 8000 });

    const viewport = graphViewportTransform(page);
    const before = await viewport.getAttribute("transform");
    await page.getByTestId("canvas-zoom-in").click();
    await expect(async () => {
      const after = await viewport.getAttribute("transform");
      expect(after).not.toBe(before);
    }).toPass({ timeout: 5000 });
    const zoomedTransform = await viewport.getAttribute("transform");
    await waitForCanvasSave(page);

    await leaveWorkspace(page);
    await reopenWorkspace(page);

    await expect(page.getByTestId("canvas-graph")).toBeVisible({ timeout: 8000 });
    const restored = await graphViewportTransform(page).getAttribute("transform");
    expect(restored).toBe(zoomedTransform);
  } finally {
    await app.close();
  }
});
