import { expect, test } from "@playwright/test";
import { launchAgentPage, launchApp } from "../agent/agent-e2e";
import { openCapturePage, openUnderstanding } from "../capture/capture-e2e";

test("@APP-NAV-001 用户从 Capture 进入 Agent 后返回 Capture", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");
    await page.getByTestId("app-module-switcher").click();
    await expect(page.getByTestId("agent-page")).toBeVisible();

    await page.getByTestId("app-module-switcher").click();
    await expect(page.getByTestId("capture-page")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@APP-NAV-002 用户打开设置并返回原工作区", async () => {
  const { app, page } = await launchAgentPage();

  try {
    const title = await page.getByTestId("agent-thread-title").textContent();
    await page.getByTestId("app-settings-menu-item").click();
    for (const section of ["ai", "storage", "retrieval", "appearance", "trash"]) {
      await page.getByTestId(`settings-menu-${section}`).click();
    }
    await page.keyboard.press("Escape");

    await expect(page.getByTestId("agent-page")).toBeVisible();
    await expect(page.getByTestId("agent-thread-title")).toHaveText(title ?? "");
  } finally {
    await app.close();
  }
});
