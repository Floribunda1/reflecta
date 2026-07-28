import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { getE2eAiEnv, getE2eElectronArgs, getE2eElectronEnv, hasE2eAiConfig } from "../test-env";

export const hasAi = hasE2eAiConfig();

export async function launchApp(
  envOverrides: Record<string, string | undefined> = {},
): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.resolve(import.meta.dirname, "../.."), ...getE2eElectronArgs()],
    env: { ...getE2eElectronEnv(), ...envOverrides },
  });
  const page = await app.firstWindow();
  return { app, page };
}

export async function launchAgentPage(envOverrides: Record<string, string | undefined> = {}) {
  const launched = await launchApp(envOverrides);
  await openAgentPage(launched.page);
  return launched;
}

export async function openAgentPage(page: Page) {
  await expect(page.getByTestId("capture-page").or(page.getByTestId("agent-page"))).toBeVisible({
    timeout: 15_000,
  });
  const agentPage = page.getByTestId("agent-page");
  await expect(async () => {
    if (await agentPage.isVisible()) return;
    await page.getByTestId("app-module-switcher").click();
    await expect(agentPage).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 15_000 });
}

export async function configureE2eAiKey(page: Page, apiKey: string) {
  const { providerId } = getE2eAiEnv();
  await page.getByTestId("app-settings-menu-item").click();
  await page.getByTestId("settings-menu-ai").click();
  await page
    .locator(`[data-testid="settings-ai-provider"][data-provider-id="${providerId}"]`)
    .click();
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
  await expect(page.getByTestId("agent-user-message").filter({ hasText: text })).toBeVisible({
    timeout: 15_000,
  });
}

export async function selectContext(page: Page, query: string, title: string, type: string) {
  await composer(page).click();
  await page.keyboard.type(`@${query}`);
  await expect(page.getByTestId("agent-context-picker")).toBeVisible({ timeout: 15_000 });
  await page
    .locator(`[data-testid="agent-context-option"][data-context-type="${type}"]`)
    .filter({ hasText: title })
    .first()
    .click();
}

export async function waitForAssistantReply(page: Page) {
  await expect(page.getByTestId("agent-assistant-text").last()).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("agent-stop-button")).toBeHidden({ timeout: 120_000 });
  await expect(composer(page)).toBeEditable();
}

export async function createNewThread(page: Page) {
  const thread = page.getByTestId("agent-thread-chat");
  const previousId = await thread.getAttribute("data-thread-id");
  await page.getByTestId("agent-new-thread-button").click();
  if (previousId) await expect(thread).not.toHaveAttribute("data-thread-id", previousId);
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

export const PDF_ATTACHMENT_PHRASE = "ZEBRACODE";

export function writePdfAttachmentFile(name = "PI_ATTACHMENT_FILE.pdf") {
  const filePath = path.join(os.tmpdir(), `reflecta-e2e-${process.pid}-${name}`);
  const stream = `BT /F1 24 Tf 72 72 Td (${PDF_ATTACHMENT_PHRASE}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  fs.writeFileSync(filePath, pdf, "binary");
  return filePath;
}
