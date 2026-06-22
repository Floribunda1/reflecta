import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { getE2eElectronEnv, hasE2eAiConfig } from "../test-env";

export const hasAi = hasE2eAiConfig();

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.resolve(import.meta.dirname, "../..")],
    env: getE2eElectronEnv(),
  });
  const page = await app.firstWindow();
  return { app, page };
}

export async function launchAgentPage() {
  const launched = await launchApp();
  await openAgentPage(launched.page);
  return launched;
}

export async function openAgentPage(page: Page) {
  await page.getByLabel("Switch module").click();
  await page.getByRole("menuitem", { name: "Agent" }).click();
  await expect(page.getByTestId("agent-page")).toBeVisible();
}

export async function configureOpenAiKey(page: Page, apiKey: string) {
  await page.getByLabel("Switch module").click();
  await page.getByTestId("app-settings-menu-item").click();
  await page.getByTestId("settings-menu-ai").click();
  await page.getByTestId("settings-ai-provider").filter({ hasText: "OpenAI" }).click();
  await page.getByTestId("settings-ai-api-key-input").fill(apiKey);
  await page.getByTestId("settings-ai-save-button").click();
  await expect(page.getByText("已保存")).toBeVisible();
  await page.keyboard.press("Escape");
}

export function composer(page: Page) {
  return page.getByTestId("agent-composer-editor").locator('[contenteditable="true"]');
}

export async function typeComposer(page: Page, text: string) {
  await composer(page).click();
  await composer(page).fill(text);
}

export async function sendMessage(page: Page, text: string) {
  await typeComposer(page, text);
  await expect(page.getByTestId("agent-send-button")).toBeEnabled();
  await page.getByTestId("agent-send-button").click();
  await expect(page.getByTestId("agent-user-message").filter({ hasText: text })).toBeVisible();
}

export async function waitForAssistantReply(page: Page) {
  await expect(page.getByTestId("agent-assistant-text").last()).toBeVisible({ timeout: 120_000 });
  await expect(composer(page)).toBeEditable();
}

export async function createNewThread(page: Page) {
  await page.getByTestId("agent-new-thread-button").click();
  await expect(page.getByTestId("agent-empty-state")).toBeVisible();
}

export function threadByTitle(page: Page, title: string) {
  return page.getByTestId("agent-thread-item").filter({ hasText: title });
}

export async function openThread(page: Page, title: string) {
  await threadByTitle(page, title).click();
}

export function writeAttachmentFile(name = "ATTACHMENT_FILE.txt") {
  const filePath = path.join(os.tmpdir(), `reflecta-e2e-${process.pid}-${name}`);
  fs.writeFileSync(filePath, "Reflecta E2E attachment content.", "utf-8");
  return filePath;
}
