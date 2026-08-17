import { expect, type Page } from "@playwright/test";

export async function openRecapPage(page: Page) {
  await expect(page.getByTestId("capture-page").or(page.getByTestId("agent-page"))).toBeVisible();
  await page.getByTestId("app-nav-module-recap").click();
  await expect(page.getByTestId("recap-page")).toBeVisible();
}

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function todayTitle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${year}年${month}月${day}日`;
}

/** 热力图中代表今天的格子（今天可能尚未参与，格子仍可点击查看明细） */
export function todayHeatmapCell(page: Page) {
  return page.getByRole("button", { name: new RegExp(`^${todayTitle()}`) }).first();
}
