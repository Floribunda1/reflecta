import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { addContext, contextCard, openCapturePage, openUnderstanding } from "./capture-e2e";

test("@CP-CONTEXT-001 用户为 Understanding 添加 Context", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");
    await addContext(page, "新增上下文", "这是新增的上下文内容");

    const card = contextCard(page, "新增上下文");
    await expect(card).toContainText("个人经历");
    await expect(card).toContainText("这是新增的上下文内容");
  } finally {
    await app.close();
  }
});

test("@CP-CONTEXT-002 用户查看并修改已有 Context", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");
    await addContext(page, "待修改上下文", "这是原始上下文内容");

    await contextCard(page, "待修改上下文").click();
    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(drawer).toContainText("待修改上下文");
    await expect(drawer).toContainText("这是原始上下文内容");
    await expect(drawer).toContainText("个人经历");
    await page.keyboard.press("Escape");

    await contextCard(page, "待修改上下文").click({ button: "right" });
    await page.getByRole("menuitem", { name: "编辑" }).click();
    await drawer.getByPlaceholder("上下文标题或场景").fill("修改后的上下文");
    await drawer.locator(".ProseMirror[contenteditable='true']").fill("这是修改后的上下文内容");
    await drawer.getByRole("button", { name: "保存" }).click();

    await contextCard(page, "修改后的上下文").click();
    await expect(drawer).toContainText("这是修改后的上下文内容");
  } finally {
    await app.close();
  }
});

test("@CP-CONTEXT-003 用户删除不再需要的 Context", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");
    await addContext(page, "CONTEXT_TO_DELETE", "DELETE_ME");
    await addContext(page, "CONTEXT_TO_KEEP", "KEEP_ME");

    await contextCard(page, "CONTEXT_TO_DELETE").click({ button: "right" });
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();

    await expect(contextCard(page, "CONTEXT_TO_DELETE")).toHaveCount(0);
    await expect(contextCard(page, "CONTEXT_TO_KEEP")).toBeVisible();
  } finally {
    await app.close();
  }
});
