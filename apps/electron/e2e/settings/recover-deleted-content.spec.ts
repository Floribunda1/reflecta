import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { deleteUnderstanding, seedUnderstandingIdByTitle } from "../agent/agent-fixtures";
import {
  addContext,
  contextCard,
  openCapturePage,
  openUnderstanding,
  understandingRow,
} from "../capture/capture-e2e";

async function openTrash(page: Page) {
  await page.getByTestId("app-settings-menu-item").click();
  await page.getByTestId("settings-menu-trash").click();
  await expect(page.getByRole("heading", { name: "回收站" })).toBeVisible();
}

function trashDialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "被删除的 Understanding 与 Context" });
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

    await page.getByRole("button", { name: "搜索理解" }).click();
    await page.getByPlaceholder("查找已有理解").fill("React Server Components");
    await expect(understandingRow(page, "React Server Components")).toBeVisible();
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

    await openTrash(page);
    const item = trashItem(page, "待恢复上下文");
    await item.hover();
    await item.getByRole("button", { name: "恢复" }).click();
    await expect(page.getByText("已恢复 Context")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(contextCard(page, "待恢复上下文")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@TRASH-003 用户永久删除回收站中的单项内容", async () => {
  const { app, page } = await launchApp();

  try {
    await openTrash(page);
    const count = trashDialog(page).getByText(/^理解 \(\d+\)$/);
    const before = Number((await count.textContent())?.match(/\d+/)?.[0]);
    const item = trashItem(page, "Soft Deleted Understanding A");
    await item.hover();
    await item.getByRole("button", { name: "永久删除" }).click();
    const dialog = page.getByRole("dialog");
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
      (
        await trashDialog(page)
          .getByText(/^理解 \(\d+\)$/)
          .textContent()
      )?.match(/\d+/)?.[0],
    );
    const contextCount = Number(
      (
        await trashDialog(page)
          .getByText(/^上下文 \(\d+\)$/)
          .textContent()
      )?.match(/\d+/)?.[0],
    );
    const total = understandingCount + contextCount;

    await page.getByRole("button", { name: "清空回收站" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`将永久删除 ${total} 项内容`);
    await dialog.getByRole("button", { name: "全部清空" }).click();
    await expect(page.getByText("回收站为空")).toBeVisible();
  } finally {
    await app.close();
  }
});
