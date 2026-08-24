import { expect, test } from "@playwright/test";
import {
  resetAgentFixtures,
  seedCanvas,
  seedDomain,
  seedUnderstanding,
} from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * 理解库面板（M5）：打开 / 领域过滤 / 搜索 / 排序 / 拖入创建 / 画布引用 / 关闭。
 * 每个场景独立 reset + seed + launch。
 */

const libraryPanel = () => page.getByTestId("canvas-library-panel");
let page: Awaited<ReturnType<typeof launchApp>>["page"];
let app: Awaited<ReturnType<typeof launchApp>>["app"];

/** 打开库面板（工作区就绪后点「理解库」按钮）。 */
async function openCanvasLibrary() {
  await h.openCanvasRow(page, "LIBCV");
  await h.openLibrary(page);
}

test("@CV-LIB-001 打开理解库面板并看到理解列表", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "libcv1", title: "LIBCV", elements: [], viewport: null });
  ({ app, page } = await launchApp());
  try {
    await openCanvasLibrary();
    await expect(libraryPanel()).toBeVisible();
    await expect(page!.getByTestId("canvas-library-item").first()).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-LIB-002 按领域过滤理解（含子领域开关）", async () => {
  resetAgentFixtures();
  seedDomain({ id: "ld_parent", name: "LIB_PARENT" });
  seedDomain({ id: "ld_sub", name: "LIB_SUB", parentId: "ld_parent" });
  seedUnderstanding({
    id: "lu_direct",
    title: "X_DIRECT",
    body: "direct",
    domainIds: ["ld_parent"],
  });
  seedUnderstanding({ id: "lu_child", title: "Y_CHILD", body: "child", domainIds: ["ld_sub"] });
  seedUnderstanding({ id: "lu_other", title: "Z_OTHER", body: "other" });
  seedCanvas({ id: "libcv2", title: "LIBCV", elements: [], viewport: null });
  ({ app, page } = await launchApp());
  try {
    await openCanvasLibrary();
    // 领域选择：LIB_PARENT（含子领域 LIB_SUB）
    await libraryPanel().getByRole("combobox").first().click();
    await page!.getByRole("option", { name: "LIB_PARENT", exact: true }).click();
    await expect(
      page!.getByTestId("canvas-library-item").filter({ hasText: "X_DIRECT" }),
    ).toBeVisible();
    await expect(
      page!.getByTestId("canvas-library-item").filter({ hasText: "Y_CHILD" }),
    ).toBeVisible();
    await expect(
      page!.getByTestId("canvas-library-item").filter({ hasText: "Z_OTHER" }),
    ).toHaveCount(0);
    // 关闭「包含子领域」→ 只剩直接理解
    await page!.getByTestId("canvas-library-include-descendants").click();
    await expect(
      page!.getByTestId("canvas-library-item").filter({ hasText: "Y_CHILD" }),
    ).toHaveCount(0);
    await expect(
      page!.getByTestId("canvas-library-item").filter({ hasText: "X_DIRECT" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-LIB-003 按关键词搜索理解并可恢复", async () => {
  resetAgentFixtures();
  seedUnderstanding({ id: "ls_one", title: "SEARCH_TARGET", body: "albatross" });
  seedUnderstanding({ id: "ls_two", title: "UNRELATED", body: "zebra" });
  seedCanvas({ id: "libcv3", title: "LIBCV", elements: [], viewport: null });
  ({ app, page } = await launchApp());
  try {
    await openCanvasLibrary();
    const search = page!.getByTestId("canvas-library-search");
    await search.fill("SEARCH_TARGET");
    await expect(
      page!.getByTestId("canvas-library-item").filter({ hasText: "SEARCH_TARGET" }),
    ).toBeVisible();
    await expect(
      page!.getByTestId("canvas-library-item").filter({ hasText: "UNRELATED" }),
    ).toHaveCount(0);
    await search.fill("");
    await expect(
      page!.getByTestId("canvas-library-item").filter({ hasText: "UNRELATED" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-LIB-004 切换排序维度改变列表顺序", async () => {
  resetAgentFixtures();
  // 更新时间排序：A 在前；创建时间排序：B 在前
  seedUnderstanding({
    id: "ls_a",
    title: "SORT_A",
    body: "a",
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
  });
  seedUnderstanding({
    id: "ls_b",
    title: "SORT_B",
    body: "b",
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  });
  seedCanvas({ id: "libcv4", title: "LIBCV", elements: [], viewport: null });
  ({ app, page } = await launchApp());
  try {
    await openCanvasLibrary();
    const firstTitle = () =>
      page!.getByTestId("canvas-library-item").first().getAttribute("data-understanding-title");
    await expect.poll(firstTitle).toBe("SORT_A");
    await page!.getByTestId("canvas-library-sort").click();
    await page!.getByText("按创建时间", { exact: true }).click();
    await expect.poll(firstTitle).toBe("SORT_B");
  } finally {
    await app.close();
  }
});

test("@CV-LIB-005 从理解库拖入理解创建理解卡", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "libcv5", title: "LIBCV", elements: [], viewport: null });
  ({ app, page } = await launchApp());
  try {
    await openCanvasLibrary();
    const graphBox = (await page!.getByTestId("canvas-graph").first().boundingBox())!;
    const row = page.locator(
      '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]',
    );
    await expect(row).toBeVisible();
    await h.dragSourceTo(page!, row, graphBox.x + 140, graphBox.y + 420);
    const card = page!
      .getByTestId("canvas-graph")
      .first()
      .getByTestId("canvas-understanding-card")
      .filter({ hasText: "React Server Components" });
    await expect(card.first()).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-LIB-006 从画布 tab 选择画布创建引用卡", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "libcv6", title: "LIBCV", elements: [], viewport: null });
  seedCanvas({
    id: "libtgt",
    title: "TARGET",
    elements: [
      {
        id: "lt_t",
        kind: "text",
        props: { text: "TARGET_NODE" },
        x: 10,
        y: 10,
        width: 140,
        height: 90,
      },
    ],
  });
  ({ app, page } = await launchApp());
  try {
    await openCanvasLibrary();
    await page!.getByRole("tab", { name: "画布" }).click();
    const item = page!.getByTestId("canvas-library-canvas-item").filter({ hasText: "TARGET" });
    await expect(item).toBeVisible();
    await item.click();
    await page!.waitForTimeout(500);
    const card = page!.getByTestId("canvas-graph").first().getByTestId("canvas-canvas-ref-card");
    await expect(card).toBeVisible();
    await expect(
      card.getByTestId("canvas-text-card").filter({ hasText: "TARGET_NODE" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-LIB-007 关闭库面板恢复画布全宽", async () => {
  resetAgentFixtures();
  seedCanvas({ id: "libcv7", title: "LIBCV", elements: [], viewport: null });
  ({ app, page } = await launchApp());
  try {
    await openCanvasLibrary();
    const graphBefore = await page!.getByTestId("canvas-graph").first().boundingBox();
    await page!.getByTestId("canvas-library-close").click();
    await expect(libraryPanel()).toHaveCount(0);
    await page!.waitForTimeout(300);
    const graphAfter = await page!.getByTestId("canvas-graph").first().boundingBox();
    expect(graphAfter && graphBefore && graphAfter.width > graphBefore.width).toBe(true);
  } finally {
    await app.close();
  }
});
