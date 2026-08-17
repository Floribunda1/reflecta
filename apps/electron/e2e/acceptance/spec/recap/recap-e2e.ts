import { expect, type Page } from "@playwright/test";

/** 参与热力图始终覆盖的完整时间范围（天），与 renderer modules/recap/stats.ts 的 RECAP_WINDOW_DAYS 保持一致 */
export const RECAP_HEATMAP_DAY_COUNT = 365;

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
