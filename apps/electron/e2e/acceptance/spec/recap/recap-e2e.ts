import { expect, type Page } from "@playwright/test";

export async function openRecapPage(page: Page) {
  await expect(page.getByTestId("capture-page").or(page.getByTestId("agent-page"))).toBeVisible();
  await page.getByTestId("app-nav-module-recap").click();
  await expect(page.getByTestId("recap-page")).toBeVisible();
}

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 热力图中代表某一天的格子（react-activity-calendar 渲染的 SVG rect） */
export function heatmapCell(page: Page, dateKey: string) {
  return page.locator(`[data-testid="recap-heatmap"] rect[data-date="${dateKey}"]`);
}
