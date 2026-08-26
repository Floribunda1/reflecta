import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { deleteUnderstanding, seedUnderstandingIdByTitle } from "../agent/agent-fixtures";
import {
  addContext,
  closeDetailPanel,
  contextCard,
  openCapturePage,
  openUnderstanding,
  understandingCard,
} from "../capture/capture-e2e";
import {
  canvasRow,
  createCanvas,
  openCanvasPage,
  renameCanvas,
  requestDeleteCanvas,
} from "../canvas/canvas-e2e";

async function openTrash(page: Page) {
  await page.getByTestId("app-settings-menu-item").click();
  await page.getByTestId("settings-menu-trash").click();
  // exact：删除后可能残留「已移到回收站」toast（toast-title 是 h2 heading），
  // 子串匹配会撞名导致 strict mode。只匹配面板标题「回收站」。
  await expect(page.getByRole("heading", { name: "回收站", exact: true })).toBeVisible();
}

async function openTrashType(page: Page, label: "理解" | "上下文" | "画布") {
  await page.getByRole("tab", { name: new RegExp(`^${label} \\(\\d+\\)$`) }).click();
}

function trashDialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "被删除的 Understanding" });
}

function trashItem(page: Page, title: string) {
  return trashDialog(page).getByText(title, { exact: false }).first().locator("..").locator("..");
}

async function deleteContext(page: Page, title: string) {
  await contextCard(page, title).click({ button: "right" });
  await page.getByRole("menuitem", { name: "删除" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
  await expect(contextCard(page, title)).toHaveCount(0);
}

test("@TRASH-001 用户恢复已删除的 Understanding", async () => {
  deleteUnderstanding(seedUnderstandingIdByTitle("React Server Components"));
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openTrash(page);
    const item = trashItem(page, "React Server Components");
    await item.hover();
    await item.getByRole("button", { name: "恢复" }).click();
    await expect(page.getByText("已恢复 Understanding")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByPlaceholder("查找已有理解").fill("React Server Components");
    await expect(understandingCard(page, "React Server Components")).toBeVisible();
    await openUnderstanding(page, "React Server Components");
  } finally {
    await app.close();
  }
});

test("@TRASH-002 用户恢复已删除的 Context", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");
    await addContext(page, "待恢复上下文", "这条上下文应该可以恢复");
    await deleteContext(page, "待恢复上下文");
    // 详情抽屉是模态浮层，会挡住设置入口；先关闭再打开回收站
    await closeDetailPanel(page);

    await openTrash(page);
    await openTrashType(page, "上下文");
    const item = trashItem(page, "待恢复上下文");
    await item.hover();
    await item.getByRole("button", { name: "恢复" }).click();
    await expect(page.getByText("已恢复 Context")).toBeVisible();
    await page.keyboard.press("Escape");

    await openUnderstanding(page, "React Server Components");
    await expect(contextCard(page, "待恢复上下文")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@TRASH-003 用户永久删除回收站中的单项内容", async () => {
  const { app, page } = await launchApp();

  try {
    await openTrash(page);
    const count = page.getByRole("tab", { name: /^理解 \(\d+\)$/ });
    const before = Number((await count.textContent())?.match(/\d+/)?.[0]);
    const item = trashItem(page, "Soft Deleted Understanding A");
    await item.hover();
    await item.getByRole("button", { name: "永久删除" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "无法恢复" });
    await expect(dialog).toContainText("无法恢复");
    await dialog.getByRole("button", { name: "永久删除" }).click();

    await expect(item).toHaveCount(0);
    await expect(count).toHaveText(`理解 (${before - 1})`);
  } finally {
    await app.close();
  }
});

test("@TRASH-004 用户清空回收站", async () => {
  const { app, page } = await launchApp();

  try {
    await openTrash(page);
    const understandingCount = Number(
      (await page.getByRole("tab", { name: /^理解 \(\d+\)$/ }).textContent())?.match(/\d+/)?.[0],
    );
    const contextCount = Number(
      (await page.getByRole("tab", { name: /^上下文 \(\d+\)$/ }).textContent())?.match(/\d+/)?.[0],
    );
    const total = understandingCount + contextCount;

    await page.getByRole("button", { name: "清空回收站" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "无法恢复" });
    await expect(dialog).toContainText(`将永久删除 ${total} 项内容`);
    await dialog.getByRole("button", { name: "全部清空" }).click();
    await expect(page.getByText("回收站为空")).toBeVisible();
  } finally {
    await app.close();
  }
});

/** 新建一张命名画布并删除（进回收站），供回收站场景复用。 */
async function createAndDeleteCanvas(page: Page, title: string) {
  await openCanvasPage(page);
  await createCanvas(page);
  await openCanvasPage(page); // 回到列表
  await renameCanvas(page, "未命名画布", title);
  await requestDeleteCanvas(page, title, true);
  await expect(canvasRow(page, title)).toHaveCount(0);
}

test("@TRASH-005 用户恢复已删除的画布", async () => {
  const { app, page } = await launchApp();

  try {
    await createAndDeleteCanvas(page, "待恢复画布");
    await openTrash(page);
    await openTrashType(page, "画布");
    const item = trashItem(page, "待恢复画布");
    await item.hover();
    await item.getByRole("button", { name: "恢复" }).click();
    await expect(page.getByText("已恢复画布")).toBeVisible();
    await page.keyboard.press("Escape");

    await openCanvasPage(page);
    await expect(canvasRow(page, "待恢复画布")).toBeVisible();
    await canvasRow(page, "待恢复画布").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@TRASH-006 用户永久删除回收站中的画布", async () => {
  const { app, page } = await launchApp();

  try {
    await createAndDeleteCanvas(page, "待永久删除画布甲");
    await createAndDeleteCanvas(page, "待永久删除画布乙");
    await openTrash(page);
    await openTrashType(page, "画布");
    const count = page.getByRole("tab", { name: /^画布 \(\d+\)$/ });
    const before = Number((await count.textContent())?.match(/\d+/)?.[0]);
    const item = trashItem(page, "待永久删除画布乙");
    await item.hover();
    await item.getByRole("button", { name: "永久删除" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "无法恢复" });
    await expect(dialog).toContainText("无法恢复");
    await dialog.getByRole("button", { name: "永久删除" }).click();

    await expect(item).toHaveCount(0);
    await expect(count).toHaveText(`画布 (${before - 1})`);
  } finally {
    await app.close();
  }
});

test("@TRASH-007 清空回收站时画布计入待永久删除数量", async () => {
  const { app, page } = await launchApp();

  try {
    await createAndDeleteCanvas(page, "待清空画布");
    await openTrash(page);
    const understandingText = await page.getByRole("tab", { name: /^理解 \(\d+\)$/ }).textContent();
    const contextText = await page.getByRole("tab", { name: /^上下文 \(\d+\)$/ }).textContent();
    const understandingCount = Number(understandingText?.match(/\d+/)?.[0]) || 0;
    const contextCount = Number(contextText?.match(/\d+/)?.[0]) || 0;
    const total = understandingCount + contextCount + 1; // +1 = 回收站中的画布

    await page.getByRole("button", { name: "清空回收站" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "无法恢复" });
    await expect(dialog).toContainText(`将永久删除 ${total} 项内容`);
    await dialog.getByRole("button", { name: "全部清空" }).click();
    await expect(page.getByText("回收站为空")).toBeVisible();
  } finally {
    await app.close();
  }
});
