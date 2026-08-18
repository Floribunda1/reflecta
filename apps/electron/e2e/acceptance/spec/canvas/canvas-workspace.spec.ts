import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  dragToGraph,
  graphViewportTransform,
  inGraph,
  leaveWorkspace,
  openWorkspace,
  waitForCanvasSave,
} from "./canvas-e2e";

test("@CV-WS-001 用户就地编辑画布标题", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);

    const titleInput = page.getByTestId("canvas-workspace-title-input");
    await titleInput.fill("RENAMED_TITLE");
    await titleInput.blur();
    await expect(titleInput).toHaveValue("RENAMED_TITLE");
    await waitForCanvasSave(page);

    await leaveWorkspace(page);
    await expect(
      page.getByTestId("canvas-list-row").filter({ hasText: "RENAMED_TITLE" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CV-WS-002 用户使用左下控制缩放画布", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    await expect(page.getByTestId("canvas-graph")).toBeVisible();

    const viewport = graphViewportTransform(page);
    const before = await viewport.getAttribute("transform");
    await page.getByTestId("canvas-zoom-in").click();
    await expect(async () => {
      const after = await viewport.getAttribute("transform");
      expect(after).not.toBe(before);
    }).toPass({ timeout: 5000 });
  } finally {
    await app.close();
  }
});

test("@CV-WS-003 用户看到右下缩略图并可定位", async () => {
  const { app, page } = await launchApp();

  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-rect", { x: 200, y: 120 });
    await expect(inGraph(page, "canvas-shape-card")).toBeVisible({ timeout: 8000 });

    const minimap = page.getByTestId("canvas-minimap");
    await expect(minimap).toBeVisible();

    // 连续放大使内容超出视口 → 缩略图视口框小于内容，点击远离处触发平移定位
    for (let i = 0; i < 4; i++) {
      await page.getByTestId("canvas-zoom-in").click();
      await page.waitForTimeout(120);
    }
    const viewport = graphViewportTransform(page);
    const before = await viewport.getAttribute("transform");
    const minimapBox = (await minimap.boundingBox())!;
    // 点击缩略图中心（放大后内容超出视口，中心点击触发 scrollTo 定位）
    await page.mouse.click(
      minimapBox.x + minimapBox.width / 2,
      minimapBox.y + minimapBox.height / 2,
    );
    await expect(async () => {
      const after = await viewport.getAttribute("transform");
      expect(after).not.toBe(before);
    }).toPass({ timeout: 5000 });
  } finally {
    await app.close();
  }
});

test("@CV-WS-004 用户在画布内搜索并定位", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-text", { x: 200, y: 180 });
    const card = inGraph(page, "canvas-text-card");
    await expect(card).toBeVisible({ timeout: 8000 });
    await card.dblclick();
    await page.getByLabel("文本卡内容").fill("SUBJECT_KEYWORD");
    await page.getByLabel("文本卡内容").blur();
    await waitForCanvasSave(page);

    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${mod}+f`);
    await expect(page.getByTestId("canvas-search-overlay")).toBeVisible();
    await page.getByTestId("canvas-search-input").fill("SUBJECT_KEYWORD");
    await expect(page.getByTestId("canvas-search-result")).toHaveCount(1);
    await page.getByTestId("canvas-search-result").first().click();
    await expect(page.getByTestId("canvas-search-overlay")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@CV-WS-005 用户进入演示模式按组走查", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page);
    await dragToGraph(page, "canvas-tool-dnd-group", { x: 200, y: 180 });
    await expect(inGraph(page, "canvas-group-node")).toBeVisible({ timeout: 8000 });
    await page.getByTestId("canvas-toggle-demo-button").click();
    await expect(page.getByTestId("canvas-demo-controls")).toBeVisible();
    await page.getByTestId("canvas-demo-next").click();
    await page.getByTestId("canvas-demo-exit").click();
    await expect(page.getByTestId("canvas-demo-controls")).toHaveCount(0);
  } finally {
    await app.close();
  }
});
