import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { dragToGraph, inGraph, openWorkspace, waitForCanvasSave } from "./canvas-e2e";

test("@CV-EDIT-002 用户框选多选并批量删除", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-text", { x: 240, y: 200 });
    await dragToGraph(page, "canvas-tool-dnd-text", { x: 260, y: 420 });
    await expect(inGraph(page, "canvas-text-card")).toHaveCount(2);
    await page.waitForTimeout(500);
    // 框住两卡（从下表包住两卡的空白出发）
    const first = (await inGraph(page, "canvas-text-card").nth(0).boundingBox())!;
    const second = (await inGraph(page, "canvas-text-card").nth(1).boundingBox())!;
    const x0 = Math.min(first.x, second.x) - 60;
    const y0 = Math.min(first.y, second.y) - 60;
    const x1 = Math.max(first.x + first.width, second.x + second.width) + 60;
    const y1 = Math.max(first.y + first.height, second.y + second.height) + 60;
    await page.mouse.move(x0, y0);
    await page.keyboard.down("Shift");
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 15 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await page.waitForTimeout(200);
    await page.keyboard.press("Backspace");
    await waitForCanvasSave(page);
    await expect(inGraph(page, "canvas-text-card")).toHaveCount(0);
  } finally {
    await app.close();
  }
});
