import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  canvasRow,
  createCanvas,
  openCanvasPage,
  renameCanvas,
  requestDeleteCanvas,
} from "./canvas-e2e";

test("@CV-CANVAS-001 无画布时用户看到引导并可创建第一张画布", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await expect(page.getByText("还没有画布")).toBeVisible();

    await page.getByTestId("canvas-empty-create-button").click();
    await expect(page.getByTestId("canvas-entry-page")).toBeVisible();

    await page.getByTestId("canvas-entry-back-button").click();
    await expect(canvasRow(page, "未命名画布")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-CANVAS-002 用户新建画布", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await page.getByTestId("canvas-create-button").click();
    await expect(page.getByTestId("canvas-entry-page")).toBeVisible();

    await page.getByTestId("canvas-entry-back-button").click();
    await expect(canvasRow(page, "未命名画布")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-CANVAS-003 用户重命名画布后重新打开仍看到新标题", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await createCanvas(page);
    await renameCanvas(page, "未命名画布", "RENAMED_CANVAS_TITLE");
    await expect(canvasRow(page, "RENAMED_CANVAS_TITLE")).toBeVisible();

    // 离开画布模块再返回：重命名已持久化
    await page.getByTestId("app-nav-module-capture").click();
    await expect(page.getByTestId("capture-page")).toBeVisible();
    await page.getByTestId("app-nav-module-canvas").click();
    await expect(canvasRow(page, "RENAMED_CANVAS_TITLE")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-CANVAS-004 用户删除不再需要的画布并确认", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await createCanvas(page);
    await renameCanvas(page, "未命名画布", "结构图 A");
    await createCanvas(page);

    await requestDeleteCanvas(page, "结构图 A", true);

    await expect(canvasRow(page, "结构图 A")).toHaveCount(0);
    await expect(page.getByTestId("canvas-list-row")).toHaveCount(1);
  } finally {
    await app.close();
  }
});

test("@CV-CANVAS-005 用户取消删除画布", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await createCanvas(page);

    await requestDeleteCanvas(page, "未命名画布", false);

    await expect(page.getByTestId("canvas-list-row")).toHaveCount(1);
  } finally {
    await app.close();
  }
});
