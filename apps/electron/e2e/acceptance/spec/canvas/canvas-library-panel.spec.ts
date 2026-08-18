import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { openWorkspace } from "./canvas-e2e";

async function openLibrary(page: import("@playwright/test").Page) {
  await openWorkspace(page);
  await page.getByTestId("canvas-toggle-library-button").click();
  await expect(page.getByTestId("canvas-library-panel")).toBeVisible();
  await expect(page.getByTestId("canvas-library-list")).toBeVisible();
}

/** 库面板所有可见行标题 */
function libraryTitles(page: import("@playwright/test").Page) {
  return page.getByTestId("canvas-library-item").allTextContents();
}

test("@CV-LIB-001 用户搜索并看到匹配的理解", async () => {
  const { app, page } = await launchApp();

  try {
    await openLibrary(page);
    await page.getByTestId("canvas-library-search").fill("React Server");

    await expect(async () => {
      const titles = await libraryTitles(page);
      expect(titles.length).toBeGreaterThan(0);
      for (const title of titles) expect(title).toContain("React Server");
    }).toPass({ timeout: 8000 });
  } finally {
    await app.close();
  }
});

test("@CV-LIB-002 用户按领域过滤理解", async () => {
  const { app, page } = await launchApp();

  try {
    await openLibrary(page);
    const before = (await libraryTitles(page)).length;

    await page.getByTestId("canvas-library-domain-filter").selectOption("Programming");
    await expect(async () => {
      const after = (await libraryTitles(page)).length;
      // 领域过滤后列表随之更新（与全部领域不同）
      expect(after).toBeGreaterThan(0);
      expect(after).not.toBe(before);
    }).toPass({ timeout: 8000 });
  } finally {
    await app.close();
  }
});

test("@CV-LIB-003 用户关闭库面板恢复全宽", async () => {
  const { app, page } = await launchApp();

  try {
    await openLibrary(page);
    await page.getByTestId("canvas-library-close").click();
    await expect(page.getByTestId("canvas-library-panel")).toHaveCount(0);
    await expect(page.getByTestId("canvas-graph")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-LIB-004 用户从库拖入理解到画布", async () => {
  const { app, page } = await launchApp();

  try {
    await openLibrary(page);
    const rsc = page.locator(
      '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]',
    );
    await expect(rsc).toBeVisible();
    const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
    const sourceBox = (await rsc.boundingBox())!;
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(graphBox.x + 200, graphBox.y + 120, { steps: 8 });
    await page.mouse.up();

    const card = page.getByTestId("canvas-graph").getByTestId("canvas-understanding-card");
    await expect(card).toBeVisible({ timeout: 8000 });
    await expect(card).toContainText("React Server Components");
  } finally {
    await app.close();
  }
});
