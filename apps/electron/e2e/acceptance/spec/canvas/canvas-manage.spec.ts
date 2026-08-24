import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import { canvasRow, openCanvasPage } from "./canvas-e2e";

/**
 * 画布管理（M1）：列表 / 新建 / 重命名 / 删除 / 空态 / 进入恢复。
 * 每个场景独立 reset + seed + launch，互不共享画布状态。
 */

test("@CV-MGMT-008 无画布时列表显示新建引导", async () => {
  resetAgentFixtures();
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    const empty = page.getByTestId("canvas-list-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("还没有画布");
    await expect(page.getByTestId("canvas-create-button")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-MGMT-001 新建画布并直接进入工作区", async () => {
  resetAgentFixtures();
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    await page.getByTestId("canvas-create-button").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible({ timeout: 8000 });
    // 默认标题「未命名画布」出现在顶栏标题输入框
    await expect(page.getByTestId("canvas-workspace-title-input")).toHaveValue("未命名画布");
    // 列表出现新画布行
    await expect(canvasRow(page, "未命名画布")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-MGMT-002 画布列表展示全部画布且新创建的在前", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "mgmt-old", title: "OLD_CANVAS", createdAt: "2020-01-01T00:00:00.000Z" });
  seedCanvas({ id: "mgmt-new", title: "NEW_CANVAS", createdAt: "2020-01-02T00:00:00.000Z" });
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    const rows = page.getByTestId("canvas-list-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveAttribute("data-canvas-title", "NEW_CANVAS");
    await expect(rows.nth(1)).toHaveAttribute("data-canvas-title", "OLD_CANVAS");
  } finally {
    await app.close();
  }
});

test("@CV-MGMT-003 从列表重命名画布并保留", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "mgmt-ren", title: "OLD_TITLE" });
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    await canvasRow(page, "OLD_TITLE").click({ button: "right" });
    await page.getByTestId("canvas-row-rename").click();
    const input = page.getByTestId("canvas-rename-input");
    await expect(input).toBeVisible();
    await input.fill("NEW_TITLE");
    await page.getByTestId("canvas-rename-confirm-button").click();
    await expect(canvasRow(page, "NEW_TITLE")).toBeVisible();
    // 重新进入画布模块仍保留
    await openCanvasPage(page);
    await expect(canvasRow(page, "NEW_TITLE")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-MGMT-004 确认删除画布后从列表消失", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "mgmt-del", title: "DOOMED" });
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    await canvasRow(page, "DOOMED").click({ button: "right" });
    await page.getByTestId("canvas-row-delete").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("删除画布");
    await expect(dialog).toContainText("全部内容");
    await expect(dialog).toContainText("回收站");
    await dialog.getByRole("button", { name: "删除" }).click();
    await expect(canvasRow(page, "DOOMED")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CV-MGMT-005 删除当前打开的画布后退出工作区", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "mgmt-cur", title: "CURRENT" });
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    await canvasRow(page, "CURRENT").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
    await canvasRow(page, "CURRENT").click({ button: "right" });
    await page.getByTestId("canvas-row-delete").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "删除" }).click();
    await expect(page.getByTestId("canvas-workspace")).toHaveCount(0);
    await expect(page.getByTestId("canvas-page")).toBeVisible();
    await expect(canvasRow(page, "CURRENT")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CV-MGMT-006 重新进入画布模块恢复上次画布", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "mgmt-last", title: "LAST_CANVAS" });
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    await canvasRow(page, "LAST_CANVAS").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
    // 离开画布模块再回来：URL 无参，应恢复上次打开的画布
    await page.getByTestId("app-nav-module-agent").click();
    await expect(page.getByTestId("canvas-workspace")).toHaveCount(0);
    await page.getByTestId("app-nav-module-canvas").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("canvas-workspace-title-input")).toHaveValue("LAST_CANVAS");
  } finally {
    await app.close();
  }
});

test("@CV-MGMT-007 在工作区顶栏就地重命名画布", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "mgmt-inline", title: "INLINE_OLD" });
  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    await canvasRow(page, "INLINE_OLD").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
    const titleInput = page.getByTestId("canvas-workspace-title-input");
    await titleInput.fill("INLINE_NEW");
    await page.keyboard.press("Enter");
    await expect(titleInput).toHaveValue("INLINE_NEW");
    // 重新进入后仍保留
    await openCanvasPage(page);
    await canvasRow(page, "INLINE_NEW").click();
    await expect(page.getByTestId("canvas-workspace-title-input")).toHaveValue("INLINE_NEW");
  } finally {
    await app.close();
  }
});
