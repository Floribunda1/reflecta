import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  composer,
  hasAi,
  launchAgentPage,
  selectContext,
  sendMessage,
  waitForAssistantReply,
  writeAttachmentFile,
} from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-CONTEXT-001 用户选中引用后发送消息", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await selectContext(page, "React", "React Server Components", "understanding");
    await selectContext(page, "React", "React", "domain");
    await composer(page).click();
    await page.keyboard.type("请比较这两个引用");
    await page.getByTestId("agent-send-button").click();
    const userMessage = page.getByTestId("agent-user-message").last();
    await expect(userMessage).toContainText("React Server Components");
    await expect(userMessage).toContainText("React");
    await waitForAssistantReply(page);
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-004 用户通过 @ 搜索选择上下文引用", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await composer(page).click();
    await page.keyboard.type("@React");
    await expect(page.getByTestId("agent-context-picker")).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .locator('[data-testid="agent-context-option"][data-context-type="understanding"]')
        .filter({ hasText: "React Server Components" }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="agent-context-option"][data-context-type="domain"]')
        .filter({ hasText: "React" }),
    ).toBeVisible();

    await page
      .locator('[data-testid="agent-context-option"][data-context-type="understanding"]')
      .filter({ hasText: "React Server Components" })
      .first()
      .click();
    await expect(
      page.locator('[data-slot="composer-context-mention"]').filter({
        hasText: "React Server Components",
      }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-005 用户点击已选择的 Understanding 引用后查看详情", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await selectContext(page, "React", "React Server Components", "understanding");
    await page
      .locator('[data-slot="composer-context-mention"]')
      .filter({ hasText: "React Server Components" })
      .click();
    await expect(page.getByTestId("agent-context-inspector")).toBeVisible();
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
      { timeout: 15_000 },
    );
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-002 用户发送附件后看到附件和回复", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();
  const filePath = writeAttachmentFile();
  const fileName = path.basename(filePath);

  try {
    const fileChooser = page.waitForEvent("filechooser");
    await page.getByTestId("agent-attachment-button").click();
    await (await fileChooser).setFiles(filePath);
    await expect(page.getByTestId("agent-attachment-preview")).toContainText(fileName);
    await sendMessage(page, "请总结这个附件");
    await expect(page.getByTestId("agent-message-attachment")).toContainText(fileName);
    await waitForAssistantReply(page);
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-003 用户选择模型和推理强度后发送消息", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await page.getByTestId("agent-model-menu-button").click();
    const firstModel = page.getByTestId("agent-model-option").first();
    const modelName = (await firstModel.locator("span").first().innerText()).trim();
    await firstModel.click();

    await page.getByTestId("agent-model-menu-button").click();
    await page
      .locator('[data-testid="agent-reasoning-option"][data-reasoning-level="medium"]')
      .click();
    await page.keyboard.press("Escape");

    await expect(page.getByTestId("agent-model-menu-button")).toContainText(modelName);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("中推理");
    await sendMessage(page, "请用一句话回复 model selection e2e");
    await expect(page.getByTestId("agent-model-menu-button")).toContainText(modelName);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("中推理");
    await waitForAssistantReply(page);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText(modelName);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("中推理");
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-006 用户打开 Agent 页面时默认使用中推理", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("中推理");
  } finally {
    await app.close();
  }
});

test("@AG-CONTEXT-008 用户粘贴 Markdown 文本后继续编辑纯文本草稿", async () => {
  const { app, page } = await launchAgentPage();

  try {
    const editor = composer(page);
    await editor.click();
    await page.evaluate(() => {
      const target = document.querySelector(
        '[data-testid="agent-composer-editor"] [contenteditable="true"]',
      );
      if (!target) throw new Error("composer editor not found");

      const data = new DataTransfer();
      data.setData("text/plain", "## Context 候选项\n\n**medium:** ai");
      data.setData("text/html", "<h2>Context 候选项</h2><p><strong>medium:</strong> ai</p>");
      target.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
      );
    });

    await expect(editor).toContainText("## Context 候选项");
    await expect(editor).toContainText("**medium:** ai");
    await expect(editor.locator("strong, b, h1, h2, h3, ul, ol")).toHaveCount(0);

    await page.keyboard.type(" 123");
    await expect(editor).toContainText("**medium:** ai 123");
    await expect(editor.locator("strong, b").filter({ hasText: "123" })).toHaveCount(0);
  } finally {
    await app.close();
  }
});
