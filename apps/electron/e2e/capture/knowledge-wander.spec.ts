import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { domainNode, openCapturePage } from "./capture-e2e";

const UNDERSTANDING_TITLE = "React Server Components";
const FULL_BODY_END = "for progressive hydration.";

async function openKnowledgeWander(page: Page) {
  await openCapturePage(page);
  await page.getByRole("button", { name: "知识漫步" }).click();
  await expect(page.getByTestId("knowledge-wander-reader")).toBeVisible();
}

function readingSection(page: Page, title = UNDERSTANDING_TITLE) {
  return page.locator(
    `[data-testid="knowledge-wander-section"][data-understanding-title="${title}"]`,
  );
}

test("@KW-WANDER-001 用户连续阅读领域中的完整理解", async () => {
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page);
    await expect(page.getByTestId("knowledge-wander-header")).toContainText("全部领域");
    await expect(page.getByTestId("knowledge-wander-header")).toContainText(/\d+ 条理解/);

    const section = readingSection(page);
    await expect(section).toContainText(FULL_BODY_END);
    await expect(section.getByLabel(/\d+ 个上下文/)).toBeVisible();
    await expect(section.getByLabel(/\d+ 个双链关系/)).toBeVisible();
    await expect(section.locator(".markdown-preview")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@KW-WANDER-002 用户从阅读页进入一条理解并回到原位置", async () => {
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page);
    const reader = page.getByTestId("knowledge-wander-reader");
    const section = readingSection(page);
    await section.scrollIntoViewIfNeeded();
    await reader.evaluate((element) => element.scrollBy({ top: 120 }));
    const scrollTop = await reader.evaluate((element) => element.scrollTop);

    await section.getByRole("button", { name: `打开理解：${UNDERSTANDING_TITLE}` }).click();
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(UNDERSTANDING_TITLE);
    await expect(page.getByText("上下文", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "关闭详情" }).click();
    await expect
      .poll(async () =>
        Math.abs((await reader.evaluate((element) => element.scrollTop)) - scrollTop),
      )
      .toBeLessThan(3);
  } finally {
    await app.close();
  }
});

test("@KW-WANDER-003 用户在知识漫步中切换领域", async () => {
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page);
    const reader = page.getByTestId("knowledge-wander-reader");
    await reader.evaluate((element) => element.scrollTo({ top: 500 }));

    await domainNode(page, "Programming").click();

    await expect(page.getByTestId("knowledge-wander-header")).toContainText("Programming");
    await expect(page.getByTestId("knowledge-wander-header")).toContainText(/\d+ 条理解/);
    await expect.poll(() => reader.evaluate((element) => element.scrollTop)).toBe(0);
  } finally {
    await app.close();
  }
});

test("@KW-WANDER-004 用户从旧入口回到 Capture", async () => {
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
