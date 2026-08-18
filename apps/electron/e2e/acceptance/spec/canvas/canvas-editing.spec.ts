import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  dragToGraph,
  firstNodeTransform,
  inGraph,
  openWorkspace,
  waitForCanvasSave,
} from "./canvas-e2e";

test("@CV-EDIT-001 用户撤销与重做", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-text", { x: 200, y: 120 });
    await expect(inGraph(page, "canvas-text-card")).toBeVisible({ timeout: 8000 });
    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+z`);
    await page.waitForTimeout(400);
    await expect(inGraph(page, "canvas-text-card")).toHaveCount(0);
    await page.keyboard.press(`${mod}+Shift+z`);
    await page.waitForTimeout(400);
    await expect(inGraph(page, "canvas-text-card")).toHaveCount(1);
  } finally {
    await app.close();
  }
});

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
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    await page.keyboard.press("Delete");
    await waitForCanvasSave(page);
    await expect(inGraph(page, "canvas-text-card")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CV-EDIT-003 用户删除组（级联）", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-group", { x: 200, y: 120 });
    const group = inGraph(page, "canvas-group-node");
    await expect(group).toBeVisible({ timeout: 8000 });
    await group.click({ button: "right" });
    await expect(page.getByTestId("canvas-group-delete")).toBeVisible();
    await page.getByTestId("canvas-group-delete").click();
    await waitForCanvasSave(page);
    await expect(inGraph(page, "canvas-group-node")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CV-EDIT-004 用户锁定元素防误拖", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-text", { x: 200, y: 120 });
    const card = inGraph(page, "canvas-text-card");
    await expect(card).toBeVisible({ timeout: 8000 });

    // 锁定
    await card.click({ button: "right" });
    await page.waitForTimeout(200);
    const lockedPos = await firstNodeTransform(page);
    const bb = (await card.boundingBox())!;
    // 尝试拖动：不应移动
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await firstNodeTransform(page)).toBe(lockedPos);

    // 解锁（再右键）→ 应可移动（先 hover 回卡片上，避免指针停留在之前拖拽终点）
    await card.hover();
    await card.click({ button: "right" });
    await page.waitForTimeout(200);
    const bb2 = (await card.boundingBox())!;
    await page.mouse.move(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb2.x + bb2.width / 2 + 60, bb2.y + bb2.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await firstNodeTransform(page)).not.toBe(lockedPos);
  } finally {
    await app.close();
  }
});
