import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  composer,
  hasAi,
  launchAgentPage,
  sendMessage,
  waitForAssistantReply,
  writeAttachmentFile,
} from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

async function selectContext(page: Page, query: string, title: string, type: string) {
  const editor = page.getByTestId("agent-composer-editor").locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.type(`@${query}`);
  await expect(page.getByTestId("agent-context-picker")).toBeVisible({ timeout: 15_000 });
  await page
    .locator(`[data-testid="agent-context-option"][data-context-type="${type}"]`)
    .filter({ hasText: title })
    .first()
    .click();
}

test("@AG-CONTEXT-001 用户选中引用后发送消息", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await selectContext(page, "React", "React Server Components", "thought");
    await selectContext(page, "React", "React", "category");
    await composer(page).click();
    await page.keyboard.type("请比较这两个引用");
    await page.getByTestId("agent-send-button").click();
    await expect(page.getByTestId("agent-user-message")).toContainText("React Server Components");
    await expect(page.getByTestId("agent-user-message")).toContainText("React");
    await waitForAssistantReply(page);
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
