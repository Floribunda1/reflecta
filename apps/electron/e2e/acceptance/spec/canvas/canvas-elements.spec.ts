import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  canvasRow,
  createCanvas,
  dragLocatorToGraph,
  dragToGraph,
  inGraph,
  openCanvasPage,
  openWorkspace,
} from "./canvas-e2e";

test("@CV-EL-001 用户从工具栏拖入文本卡并编辑内容", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);

    await dragToGraph(page, "canvas-tool-dnd-text", { x: 200, y: 120 });
    const textCard = inGraph(page, "canvas-text-card");
    await expect(textCard).toBeVisible({ timeout: 8000 });

    await textCard.dblclick();
    const textarea = page.getByLabel("文本卡内容");
    await expect(textarea).toBeVisible();
    await textarea.fill("TEXT_BODY");
    await textarea.blur();
    await expect(textCard).toContainText("TEXT_BODY");
  } finally {
    await app.close();
  }
});

test("@CV-EL-002 用户从工具栏拖入图形", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-rect", { x: 200, y: 120 });
    await expect(inGraph(page, "canvas-shape-card")).toBeVisible({ timeout: 8000 });
  } finally {
    await app.close();
  }
});

test("@CV-EL-003 用户创建组并编辑组名", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-group", { x: 200, y: 120 });
    const group = inGraph(page, "canvas-group-node");
    await expect(group).toBeVisible({ timeout: 8000 });

    await inGraph(page, "canvas-group-label").dblclick();
    const labelInput = page.getByLabel("组名");
    await expect(labelInput).toBeVisible();
    await labelInput.fill("GROUP_LABEL");
    await labelInput.blur();
    await expect(group).toContainText("GROUP_LABEL");
  } finally {
    await app.close();
  }
});

test("@CV-EL-004 用户从理解库拖入理解卡", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    await page.getByTestId("canvas-toggle-library-button").click();
    await expect(page.getByTestId("canvas-library-panel")).toBeVisible();

    const rscItem = page.locator(
      '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]',
    );
    await expect(rscItem).toBeVisible();
    await dragLocatorToGraph(page, rscItem, { x: 200, y: 120 });
    const understandingCard = inGraph(page, "canvas-understanding-card");
    await expect(understandingCard).toBeVisible({ timeout: 8000 });
    await expect(understandingCard).toContainText("React Server Components");
  } finally {
    await app.close();
  }
});

test("@CV-EL-005 用户引用另一张画布并跳转", async () => {
  const { app, page } = await launchApp();

  try {
    await openCanvasPage(page);
    await createCanvas(page);
    await createCanvas(page); // 第二张画布作为引用目标
    await canvasRow(page, "未命名画布").first().click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();

    await page.getByTestId("canvas-open-canvasref-picker").click();
    await expect(page.getByTestId("canvas-ref-picker-option").first()).toBeVisible();
    await page.getByTestId("canvas-ref-picker-option").first().click();

    const refCard = inGraph(page, "canvas-canvas-ref-card");
    await expect(refCard).toBeVisible({ timeout: 8000 });

    await refCard.click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-EL-006 用户通过右键删除组", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    // X6 Dnd 落点 = 光标点 - 节点尺寸/2：光标 (310,240) → 组左上角 ≈ (150,120)
    await dragToGraph(page, "canvas-tool-dnd-group", { x: 310, y: 240 });
    const group = inGraph(page, "canvas-group-node");
    await expect(group).toBeVisible({ timeout: 8000 });

    // 右键组 → 删除组（级联语义由单测覆盖）
    await group.click({ button: "right" });
    await page.getByTestId("canvas-group-delete").click();

    await expect(inGraph(page, "canvas-group-node")).toHaveCount(0);
  } finally {
    await app.close();
  }
});
