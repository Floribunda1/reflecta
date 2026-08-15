import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";

const AYU_LIGHT_BG = "#f8f9fa";
const AYU_LIGHT_BASE0D = "#3199e1";
const AYU_LIGHT_ACCENT = "#ffaa33";

async function openAppearanceSettings(page: Page) {
  await page.getByTestId("app-settings-menu-item").click();
  await page.getByTestId("settings-menu-appearance").click();
  await expect(page.getByRole("heading", { name: "主题" })).toBeVisible();
}

async function selectTheme(page: Page, name: string) {
  await page.getByTestId("theme-search").fill(name);
  await page.getByTestId(`theme-option-${name}`).locator("button").first().click();
}

async function cssVar(page: Page, name: string) {
  return page.evaluate(
    (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim(),
    name,
  );
}

test("@APPEARANCE-SETTINGS-001 用户选择主题后界面使用该主题", async () => {
  const { app, page } = await launchApp();

  try {
    await openAppearanceSettings(page);
    await selectTheme(page, "Ayu");
    await expect.poll(() => cssVar(page, "--base00")).toBe(AYU_LIGHT_BG);
  } finally {
    await app.close();
  }
});

test("@APPEARANCE-SETTINGS-002 用户为某个主题选择主色", async () => {
  const { app, page } = await launchApp();

  try {
    await openAppearanceSettings(page);
    await selectTheme(page, "Ayu");
    await page.getByTestId("theme-primary-slot-Ayu-base0d").click();
    await expect.poll(() => cssVar(page, "--primary")).toBe(AYU_LIGHT_BASE0D);
  } finally {
    await app.close();
  }
});

test("@APPEARANCE-SETTINGS-003 用户恢复该主题自带主色", async () => {
  const { app, page } = await launchApp();

  try {
    await openAppearanceSettings(page);
    await selectTheme(page, "Ayu");
    await page.getByTestId("theme-primary-slot-Ayu-base0d").click();
    await expect.poll(() => cssVar(page, "--primary")).toBe(AYU_LIGHT_BASE0D);
    await page.getByTestId("theme-primary-slot-Ayu-default").click();
    await expect.poll(() => cssVar(page, "--primary")).toBe(AYU_LIGHT_ACCENT);
  } finally {
    await app.close();
  }
});

test("@APPEARANCE-SETTINGS-004 用户重启后仍使用上次的主题和主色", async () => {
  let launched = await launchApp();

  try {
    await openAppearanceSettings(launched.page);
    await selectTheme(launched.page, "Ayu");
    await launched.page.getByTestId("theme-primary-slot-Ayu-base0d").click();
    await expect.poll(() => cssVar(launched.page, "--primary")).toBe(AYU_LIGHT_BASE0D);

    await launched.app.close();
    launched = await launchApp();
    await expect.poll(() => cssVar(launched.page, "--base00")).toBe(AYU_LIGHT_BG);
    await expect.poll(() => cssVar(launched.page, "--primary")).toBe(AYU_LIGHT_BASE0D);
    await openAppearanceSettings(launched.page);
    await launched.page.getByTestId("theme-search").fill("Ayu");
    await expect(launched.page.getByTestId("theme-option-Ayu")).toBeVisible();
  } finally {
    await launched.app.close();
  }
});
