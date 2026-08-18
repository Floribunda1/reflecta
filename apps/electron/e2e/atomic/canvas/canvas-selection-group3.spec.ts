import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { dragToGraph, inGraph, openWorkspace } from "../../acceptance/spec/canvas/canvas-e2e";

async function marquee(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  shift = false,
) {
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  if (shift) await page.keyboard.up("Shift");
}

async function drawEdge(page: Page, from: number, to: number) {
  const cards = inGraph(page, "canvas-text-card");
  const source = (await cards.nth(from).boundingBox())!;
  const target = (await cards.nth(to).boundingBox())!;
  await page.mouse.move(source.x + source.width - 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 2, target.y + target.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
}

test.describe("画布原子操作 Group 3：选中与框选", () => {
  test("@CV-ATOM-021 点击节点后仅该节点可作为选中目标", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 520, y: 140 });
      const cards = inGraph(page, "canvas-text-card");
      const first = (await cards.nth(0).boundingBox())!;
      await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
      await page.waitForTimeout(200);
      await page.keyboard.press("Delete");
      await expect(cards).toHaveCount(1);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-022 点击边后仅该边可作为选中目标", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 520, y: 140 });
      await drawEdge(page, 0, 1);
      const cards = inGraph(page, "canvas-text-card");
      const first = (await cards.nth(0).boundingBox())!;
      const second = (await cards.nth(1).boundingBox())!;
      const mid = {
        x: (first.x + first.width + second.x) / 2,
        y: first.y + first.height / 2,
      };
      await page.mouse.click(mid.x, mid.y);
      await expect(page.getByTestId("canvas-edge-style-panel")).toBeVisible();
      await page.keyboard.press("Delete");
      await expect(inGraph(page, "canvas-text-card")).toHaveCount(2);
      await expect(page.getByTestId("canvas-graph").locator(".x6-edge")).toHaveCount(0);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-023 点击空白处清除节点选中", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      const card = inGraph(page, "canvas-text-card");
      await card.click();
      const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
      await page.mouse.click(graphBox.x + 40, graphBox.y + 40);
      await page.keyboard.press("Delete");
      await expect(card).toHaveCount(1);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-024 左到右框选只选中完全包含的节点", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 560, y: 140 });
      const cards = inGraph(page, "canvas-text-card");
      const first = (await cards.nth(0).boundingBox())!;
      const second = (await cards.nth(1).boundingBox())!;
      await marquee(
        page,
        { x: first.x - 30, y: first.y - 30 },
        { x: second.x + second.width / 2, y: first.y + first.height + 30 },
      );
      await page.keyboard.press("Delete");
      await expect(cards).toHaveCount(1);
      await expect(cards.nth(0)).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-025 右到左框选选中与框相交的节点", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 560, y: 140 });
      const cards = inGraph(page, "canvas-text-card");
      const first = (await cards.nth(0).boundingBox())!;
      const second = (await cards.nth(1).boundingBox())!;
      await marquee(
        page,
        { x: second.x + second.width + 30, y: first.y - 30 },
        { x: first.x + first.width / 2, y: first.y + first.height + 30 },
      );
      await page.keyboard.press("Delete");
      await expect(cards).toHaveCount(0);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-026 Shift 框选追加到已有选区", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 560, y: 140 });
      const cards = inGraph(page, "canvas-text-card");
      const second = (await cards.nth(1).boundingBox())!;
      const first = (await cards.nth(0).boundingBox())!;
      await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
      await page.waitForTimeout(200);
      await marquee(
        page,
        { x: second.x - 30, y: second.y - 30 },
        { x: second.x + second.width + 30, y: second.y + second.height + 30 },
        true,
      );
      await page.keyboard.press("Delete");
      await expect(cards).toHaveCount(0);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-027 框选边所在区域不把边识别为节点", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 520, y: 140 });
      await drawEdge(page, 0, 1);
      const cards = inGraph(page, "canvas-text-card");
      const first = (await cards.nth(0).boundingBox())!;
      const second = (await cards.nth(1).boundingBox())!;
      const midpoint = {
        x: (first.x + first.width + second.x) / 2,
        y: first.y + first.height / 2,
      };
      await marquee(
        page,
        { x: midpoint.x - 50, y: midpoint.y - 45 },
        { x: midpoint.x + 50, y: midpoint.y + 45 },
      );
      await page.keyboard.press("Delete");
      await expect(cards).toHaveCount(2);
      await expect(page.getByTestId("canvas-graph").locator(".x6-edge")).toHaveCount(1);
    } finally {
      await app.close();
    }
  });
});
