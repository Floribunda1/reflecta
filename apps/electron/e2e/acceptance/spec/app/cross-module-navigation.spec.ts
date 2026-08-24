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

    // 返回画布模块：无参进入时恢复到上次打开的画布（右侧工作区重新展开）
    await openCanvasPage(page);
    await expect(page.getByTestId("canvas-list-panel")).toBeVisible();
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

test("@CV-NAV-003 无参重新进入画布模块恢复上次选择的画布", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await createCanvas(page);
    await openCanvasPage(page); // 回到列表
    await canvasRow(page, "未命名画布").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();

    // 离开画布模块，再无参进入：应恢复到上次打开的画布
    await page.getByTestId("app-nav-module-capture").click();
    await expect(page.getByTestId("capture-page")).toBeVisible();
    await page.getByTestId("app-nav-module-canvas").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
    await expect(page.getByTestId("canvas-workspace-title-input")).toHaveValue("未命名画布");
  } finally {
    await app.close();
  }
});

test("@CV-NAV-004 上次选择的画布已删除时回到空态", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await createCanvas(page);
    await openCanvasPage(page); // 回到列表
    await canvasRow(page, "未命名画布").click(); // 打开并记忆该画布
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();

    // 删除该画布（行右键菜单 → 确认）
    await openCanvasPage(page);
    await canvasRow(page, "未命名画布").click({ button: "right" });
    await page.getByTestId("canvas-row-delete").click();
    await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
    await expect(canvasRow(page, "未命名画布")).toHaveCount(0);

    // 离开再无参进入：记忆已失效，应回到选择画布空态而非已删除的画布
    await page.getByTestId("app-nav-module-capture").click();
    await expect(page.getByTestId("capture-page")).toBeVisible();
    await page.getByTestId("app-nav-module-canvas").click();
    await expect(page.getByTestId("canvas-page")).toBeVisible();
  } finally {
    await app.close();
  }
});
