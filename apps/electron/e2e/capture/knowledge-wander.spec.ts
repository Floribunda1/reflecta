import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { domainNode, openCapturePage } from "./capture-e2e";

const UNDERSTANDING_TITLE = "React Server Components";
const FULL_BODY_END = "for progressive hydration.";

async function openKnowledgeWander(page: Page, domainName?: string) {
  await openCapturePage(page);
  if (domainName) await domainNode(page, domainName).click();
  await page.getByRole("button", { name: "知识漫步" }).click();
  await expect(page.getByTestId("knowledge-wander-waterfall")).toBeVisible();
}

test("@KW-WANDER-001 用户连续阅读完整理解并打开详情", async () => {
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page);
    await expect(page.getByTestId("knowledge-wander-header")).toContainText("全部领域");
    await expect(page.getByTestId("knowledge-wander-header")).toContainText(/\d+ 条理解/);

    const card = page.locator(
      `[data-testid="knowledge-wander-card"][data-understanding-title="${UNDERSTANDING_TITLE}"]`,
    );
    await expect(card).toContainText(FULL_BODY_END);
    await card.click();
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(UNDERSTANDING_TITLE);

    const waterfall = page.getByTestId("knowledge-wander-waterfall");
    await waterfall.evaluate((element) => element.scrollTo({ top: 320 }));
    const scrollTop = await waterfall.evaluate((element) => element.scrollTop);
    await page.getByRole("button", { name: "关闭详情" }).click();
    await expect.poll(() => waterfall.evaluate((element) => element.scrollTop)).toBe(scrollTop);
  } finally {
    await app.close();
  }
});

test("@KW-WANDER-002 用户切换图谱观察真实关系", async () => {
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page, "Programming");
    await expect(page.getByTestId("knowledge-wander-header")).toContainText("Programming");
    const waterfall = page.getByTestId("knowledge-wander-waterfall");
    await waterfall.evaluate((element) => element.scrollTo({ top: 280 }));
    const scrollTop = await waterfall.evaluate((element) => element.scrollTop);

    await page.getByRole("button", { name: "图谱" }).click();
    await expect(page.getByTestId("knowledge-wander-graph")).toBeVisible();
    await expect(page.getByRole("button", { name: "适应画布" })).toBeVisible({
      timeout: 30_000,
    });

    const graphNode = page
      .getByLabel("图谱理解")
      .getByRole("button", { name: UNDERSTANDING_TITLE });
    await graphNode.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(UNDERSTANDING_TITLE);
    await page.getByRole("button", { name: "关闭详情" }).click();

    await page.getByRole("button", { name: "瀑布流" }).click();
    await expect(waterfall).toBeVisible();
    await expect.poll(() => waterfall.evaluate((element) => element.scrollTop)).toBe(scrollTop);
  } finally {
    await app.close();
  }
});

test("@KW-WANDER-003 用户从旧入口回到 Capture", async () => {
  const { app, page } = await launchApp();

  try {
    await page.evaluate(() => {
      window.location.hash = "#/contemplate";
    });
    await expect(page.getByTestId("capture-page")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#/capture");

    await page.getByLabel("Switch module").click();
    await expect(page.getByRole("menuitem", { name: "Capture" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Agent" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Contemplate" })).toHaveCount(0);
  } finally {
    await app.close();
  }
});
