import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { openAgentPage } from "../agent/agent-e2e";
import { getE2eElectronEnv } from "../test-env";

async function launchIsolatedApp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-ai-settings-e2e-"));
  const appConfigDir = path.join(root, "config");
  const app = await electron.launch({
    args: [
      path.resolve(import.meta.dirname, "../.."),
      "--reflecta-user-data-dir",
      path.join(root, "user-data"),
      "--reflecta-app-config-dir",
      appConfigDir,
      "--reflecta-content-root",
      path.join(root, "content"),
    ],
    env: getE2eElectronEnv(),
  });
  return { app, page: await app.firstWindow(), root };
}

async function openAiSettings(page: Awaited<ReturnType<typeof launchIsolatedApp>>["page"]) {
  await page.getByTestId("app-settings-menu-item").click();
  await page.getByTestId("settings-menu-ai").click();
}

async function toggleModel(
  page: Awaited<ReturnType<typeof launchIsolatedApp>>["page"],
  modelId: string,
) {
  await page.getByTestId("settings-ai-model-search").fill(modelId);
  await page
    .locator(`[data-testid="settings-ai-model-option"][data-model-id="${modelId}"]`)
    .click();
}

async function configureOpenAiModels(page: Awaited<ReturnType<typeof launchIsolatedApp>>["page"]) {
  await openAiSettings(page);
  await page.locator('[data-testid="settings-ai-provider"][data-provider-id="openai"]').click();
  await page.getByTestId("settings-ai-api-key-input").fill("test-key");
  await toggleModel(page, "gpt-4o");
  await toggleModel(page, "o3");
  await page.getByTestId("settings-ai-save-button").click();
  await expect(page.getByText("已保存")).toBeVisible();
}

test("@AI-SETTINGS-001 用户为 Provider 选择用于 Chat 的模型", async () => {
  const { app, page, root } = await launchIsolatedApp();

  try {
    await configureOpenAiModels(page);
    await page.keyboard.press("Escape");

    await openAgentPage(page);
    await page.getByTestId("agent-model-menu-button").click();
    await expect(page.getByTestId("agent-model-option")).toHaveCount(2);
    await expect(page.getByTestId("agent-reasoning-option")).toHaveCount(0);
    await page.locator('[data-testid="agent-model-option"][data-model-id="o3"]').click();
    await page.getByTestId("agent-model-menu-button").click();
    await expect(
      page.locator('[data-testid="agent-reasoning-option"][data-reasoning-level="medium"]'),
    ).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("@AI-SETTINGS-002 用户停用当前模型后自动使用仍然启用的模型", async () => {
  const { app, page, root } = await launchIsolatedApp();

  try {
    await configureOpenAiModels(page);
    await page.getByTestId("settings-ai-title-model").selectOption("openai:o3");
    await page.getByTestId("settings-ai-save-button").click();
    await expect(page.getByText("已保存")).toBeVisible();
    await page.keyboard.press("Escape");

    await openAgentPage(page);
    await page.getByTestId("agent-model-menu-button").click();
    await page.locator('[data-testid="agent-model-option"][data-model-id="o3"]').click();

    await openAiSettings(page);
    await page.locator('[data-testid="settings-ai-provider"][data-provider-id="openai"]').click();
    await toggleModel(page, "o3");
    await page.getByTestId("settings-ai-save-button").click();
    await expect(page.getByText("已保存")).toBeVisible();
    await expect(page.getByTestId("settings-ai-title-model")).toHaveValue("openai:gpt-4o");
    await page.keyboard.press("Escape");

    await openAgentPage(page);
    await expect(page.getByTestId("agent-model-menu-button")).toContainText("GPT-4o");
    await page.getByTestId("agent-model-menu-button").click();
    await expect(page.getByTestId("agent-model-option")).toHaveCount(1);
    await expect(page.getByTestId("agent-model-option")).toHaveAttribute("data-model-id", "gpt-4o");
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
