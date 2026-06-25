import { expect, type Page } from "@playwright/test";

export async function openCapturePage(page: Page) {
  await page.getByLabel("Switch module").click();
  await page.getByRole("menuitem", { name: "Capture" }).click();
  await expect(page.getByTestId("capture-page")).toBeVisible();
}

export function domainNode(page: Page, name: string) {
  return page.locator(`[data-testid="capture-domain-node"][data-domain-name="${name}"]`);
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
