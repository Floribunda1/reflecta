import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { canvasRow, createCanvas, openCanvasPage } from "../canvas/canvas-e2e";

test("@CV-NAV-001 用户从画布列表进入画布", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await createCanvas(page);
    await openCanvasPage(page); // 回到列表

    await canvasRow(page, "未命名画布").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
    await expect(page.getByTestId("canvas-workspace-title-input")).toHaveValue("未命名画布");

    // 返回列表
    await openCanvasPage(page);
    await expect(page.getByTestId("canvas-page")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-NAV-002 外部带参跳转直接打开指定画布", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await createCanvas(page);
    await openCanvasPage(page); // 回到列表

    const canvasId = await canvasRow(page, "未命名画布").getAttribute("data-canvas-id");
    expect(canvasId).toBeTruthy();

    // 离开画布模块（模拟外部触发点：M6-6 / M3-E / U4 接收端）
    await page.getByTestId("app-nav-module-capture").click();
    await expect(page.getByTestId("capture-page")).toBeVisible();

    // 带参入口（navigateToCanvas 的效果等价）：hash 路由 ?canvas=<id>
    await page.evaluate((id) => {
      window.location.hash = `/understanding-canvas?canvas=${id}`;
    }, canvasId as string);

    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
    await expect(page.getByTestId("canvas-workspace-title-input")).toHaveValue("未命名画布");
  } finally {
    await app.close();
  }
});
