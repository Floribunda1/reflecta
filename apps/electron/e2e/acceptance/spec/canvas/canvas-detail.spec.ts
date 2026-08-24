import { expect, test } from "@playwright/test";
import {
  resetAgentFixtures,
  seedCanvas,
  seedUnderstandingIdByTitle,
  understandingExistsByTitle,
} from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * 画布侧理解详情联动（M6）：详情编辑同步卡片 / 库详情互斥 / 关闭恢复 / 画布归属跳转。
 * RSC 卡：引用 baseline 的 React Server Components。
 */

async function seedCanvasWithRsc(id: string, title: string) {
  seedCanvas({
    id,
    title,
    elements: [
      {
        id: `${id}_rsc`,
        kind: "understanding",
        understandingId: seedUnderstandingIdByTitle("React Server Components"),
        props: {},
        x: 100,
        y: 100,
        width: 260,
        height: 160,
      },
    ],
  });
}

test("@CV-DETAIL-001 编辑理解后画布卡片同步", async () => {
  resetAgentFixtures();
  await seedCanvasWithRsc("cvxd1", "DV1");
  const { app, page } = await launchApp();
  try {
    await h.openCanvasRow(page, "DV1");
    const card = page
      .getByTestId("canvas-graph")
      .first()
      .getByTestId("canvas-understanding-card")
      .filter({ hasText: "React Server Components" })
      .first();
    await card.click({ clickCount: 2 });
    const panel = page!.getByTestId("canvas-detail-panel");
    await expect(panel).toBeVisible({ timeout: 8000 });
    // 详情内改标题并失焦（自动保存）
    await page!.getByPlaceholder("写下一个刚形成的理解").fill("SYNCED_TITLE");
    await page!.locator(".ProseMirror[contenteditable='true']").first().click();
    await expect.poll(() => understandingExistsByTitle("SYNCED_TITLE")).toBe(true);
    // 画布卡片同步显示新标题
    await expect
      .poll(
        () =>
          page
            .getByTestId("canvas-graph")
            .first()
            .getByTestId("canvas-understanding-card")
            .filter({ hasText: "SYNCED_TITLE" })
            .count(),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});

test("@CV-DETAIL-002 库面板与详情面板互斥切换", async () => {
  resetAgentFixtures();
  await seedCanvasWithRsc("cvxd2", "DV2");
  const { app, page } = await launchApp();
  try {
    await h.openCanvasRow(page, "DV2");
    await h.openLibrary(page);
    await expect(page!.getByTestId("canvas-library-panel")).toBeVisible();
    // 打开详情 → 库面板关闭
    const card = page
      .getByTestId("canvas-graph")
      .first()
      .getByTestId("canvas-understanding-card")
      .filter({ hasText: "React Server Components" })
      .first();
    await card.click({ clickCount: 2 });
    await expect(page!.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });
    await expect(page!.getByTestId("canvas-library-panel")).toHaveCount(0);
    // 再开库 → 详情面板关闭
    await page!.getByTestId("canvas-toggle-library-button").click();
    await expect(page!.getByTestId("canvas-library-panel")).toBeVisible();
    await expect(page!.getByTestId("canvas-detail-panel")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CV-DETAIL-003 关闭详情面板后画布保持原状", async () => {
  resetAgentFixtures();
  await seedCanvasWithRsc("cvxd3", "DV3");
  const { app, page } = await launchApp();
  try {
    await h.openCanvasRow(page, "DV3");
    const cardId = "cvxd3_rsc";
    const beforeBox = await page
      .getByTestId("canvas-graph")
      .first()
      .getByTestId("canvas-understanding-card")
      .first()
      .boundingBox();
    await h.clickNode(page, cardId);
    await h.nodeInGraph(page, cardId).first().click({ clickCount: 2 });
    await expect(page!.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });
    const graphBefore = await page!.getByTestId("canvas-graph").first().boundingBox();
    await page!.getByTestId("canvas-detail-panel").getByLabel("关闭详情").click();
    await expect(page!.getByTestId("canvas-detail-panel")).toHaveCount(0);
    await page!.waitForTimeout(300);
    const graphAfter = await page!.getByTestId("canvas-graph").first().boundingBox();
    expect(graphAfter && graphBefore && graphAfter.width > graphBefore.width).toBe(true);
    const afterBox = await page
      .getByTestId("canvas-graph")
      .first()
      .getByTestId("canvas-understanding-card")
      .first()
      .boundingBox();
    expect(afterBox).toEqual(beforeBox);
  } finally {
    await app.close();
  }
});

test("@CV-DETAIL-004 理解详情显示画布归属并可跳转", async () => {
  resetAgentFixtures();
  await seedCanvasWithRsc("cvxd4a", "DV4_A");
  await seedCanvasWithRsc("cvxd4b", "DV4_B");
  const { app, page } = await launchApp();
  try {
    await h.openCanvasRow(page, "DV4_A");
    const card = page
      .getByTestId("canvas-graph")
      .first()
      .getByTestId("canvas-understanding-card")
      .filter({ hasText: "React Server Components" })
      .first();
    await card.click({ clickCount: 2 });
    await expect(page!.getByTestId("canvas-detail-panel")).toBeVisible({ timeout: 8000 });
    // 关联画布计数 = 2（DV4_A + DV4_B 都引用了这条理解）
    const membership = page!.getByTestId("canvas-detail-panel").getByLabel("查看关联画布，共 2 个");
    await expect(membership).toBeVisible();
    await membership.hover();
    await expect(page!.getByText("关联画布")).toBeVisible();
    await page!.getByRole("button").filter({ hasText: "DV4_B" }).first().click();
    // 跳转到 DV4_B 的工作区
    await expect(page!.getByTestId("canvas-workspace")).toBeVisible({ timeout: 8000 });
    await expect(page!.getByTestId("canvas-workspace-title-input")).toHaveValue("DV4_B");
  } finally {
    await app.close();
  }
});
