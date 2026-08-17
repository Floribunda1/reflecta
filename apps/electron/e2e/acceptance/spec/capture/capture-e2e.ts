import { expect, type Page } from "@playwright/test";

export async function openCapturePage(page: Page) {
  await expect(page.getByTestId("capture-page").or(page.getByTestId("agent-page"))).toBeVisible();
  if (await page.getByTestId("agent-page").isVisible()) {
    await page.getByTestId("app-nav-module-capture").click();
  }
  await expect(page.getByTestId("capture-page")).toBeVisible();
}

/** 参与概览热力图始终覆盖的完整时间范围（天），与 renderer 的 PARTICIPATION_WINDOW_DAYS 保持一致 */
export const PARTICIPATION_HEATMAP_DAY_COUNT = 365;

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 参与概览热力图中代表某一天的格子（react-activity-calendar 渲染的 SVG rect） */
export function participationHeatmapCell(page: Page, dateKey: string) {
  return page.locator(`[data-testid="participation-heatmap"] rect[data-date="${dateKey}"]`);
}

export function domainNode(page: Page, name: string) {
  return page.locator(`[data-testid="capture-domain-node"][data-domain-name="${name}"]`);
}

export function understandingCard(page: Page, title: string) {
  return page.locator(
    `[data-testid="capture-understanding-card"][data-understanding-title="${title}"]`,
  );
}

export function domainChip(page: Page, name: string) {
  return page.locator(`[data-testid="capture-domain-node"][data-domain-name="${name}"]`);
}

export function understandingTitleInput(page: Page) {
  return page.getByPlaceholder("写下一个刚形成的理解");
}

/** 详情面板是右侧内联面板；切卡片/切模块前先关闭（用面板内关闭按钮，Escape 在编辑器/控件内可能被吞）。 */
export async function closeDetailPanel(page: Page) {
  const panel = page.getByTestId("capture-understanding-detail-panel");
  if (await panel.isVisible()) {
    await panel.getByLabel("关闭详情").click();
    await expect(panel).toBeHidden();
  }
}

export function understandingEditor(page: Page) {
  return page.locator(".ProseMirror[contenteditable='true']").first();
}

export async function openUnderstanding(page: Page, title: string) {
  await closeDetailPanel(page);
  await understandingCard(page, title).click();
  await expect(understandingTitleInput(page)).toHaveValue(title);
}

export function contextCard(page: Page, title: string) {
  return page.getByRole("button").filter({ hasText: title });
}

export async function addContext(page: Page, title: string, content: string) {
  await page.getByRole("button", { name: "添加上下文" }).click();
  // 上下文以 Sheet 形式弹出（详情为右侧内联面板，非浮层，无需排除）
  const drawer = page.locator('[data-slot="sheet-content"]');
  await expect(drawer).toContainText("添加上下文");
  await drawer.getByRole("tab", { name: "个人经历" }).click();
  await drawer.getByPlaceholder("上下文标题或场景").fill(title);
  await drawer.locator(".ProseMirror[contenteditable='true']").fill(content);
  await drawer.getByRole("button", { name: "保存" }).click();
  await expect(drawer).toBeHidden();
}

export function sortableDomainNode(page: Page, name: string) {
  return page.locator(`[data-testid="capture-domain-sortable-node"][data-domain-name="${name}"]`);
}

export function domainToggle(page: Page, name: string) {
  return page.locator(`[data-testid="capture-domain-toggle"][data-domain-name="${name}"]`);
}

export async function expandDomain(page: Page, name: string, expectedChildName: string) {
  await domainToggle(page, name).click();
  await expect(domainNode(page, expectedChildName)).toBeVisible();
}

export async function visibleDomainNames(page: Page): Promise<string[]> {
  return page
    .getByTestId("capture-domain-node")
    .evaluateAll((nodes) =>
      nodes.flatMap((node) => (node instanceof HTMLElement && node.dataset.domainName) || []),
    );
}

export async function dragDomainOnto(page: Page, sourceName: string, targetName: string) {
  const source = domainNode(page, sourceName);
  const target = domainNode(page, targetName);
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Domain drag target is not visible");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
}

export async function expectDomainBefore(page: Page, before: string, after: string) {
  await expect
    .poll(async () => {
      const names = await visibleDomainNames(page);
      return names.indexOf(before) < names.indexOf(after);
    })
    .toBe(true);
}
