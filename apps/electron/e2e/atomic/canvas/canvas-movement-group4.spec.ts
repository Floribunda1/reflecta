import { expect, test, type Locator, type Page } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import {
  dragLocatorToGraph,
  dragToGraph,
  firstNodeTransform,
  inGraph,
  leaveWorkspace,
  openWorkspace,
  reopenWorkspace,
  waitForCanvasSave,
} from "../../acceptance/spec/canvas/canvas-e2e";

function graphNode(page: Page, testId: string, index = 0): Locator {
  return inGraph(page, testId)
    .nth(index)
    .locator("xpath=ancestor::*[contains(@class, 'x6-node')]")
    .first();
}

async function dragBy(page: Page, target: Locator, dx: number, dy: number) {
  const box = (await target.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + dx, center.y + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function marqueeAll(page: Page, cards: Locator) {
  const boxes = await Promise.all(
    Array.from({ length: await cards.count() }, (_, index) => cards.nth(index).boundingBox()),
  );
  const x0 = Math.min(...boxes.map((box) => box!.x)) - 60;
  const y0 = Math.min(...boxes.map((box) => box!.y)) - 60;
  const x1 = Math.max(...boxes.map((box) => box!.x + box!.width)) + 60;
  const y1 = Math.max(...boxes.map((box) => box!.y + box!.height)) + 60;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 15 });
  await page.mouse.up();
}

test.describe("画布原子操作 Group 4：移动与尺寸", () => {
  test("@CV-ATOM-029 拖动普通节点后位置更新", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      const before = await firstNodeTransform(page);
      await dragBy(page, inGraph(page, "canvas-text-card"), 80, 40);
      expect(await firstNodeTransform(page)).not.toBe(before);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-030 拖动组后组位置更新", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-group", { x: 260, y: 220 });
      const before = await graphNode(page, "canvas-group-node").getAttribute("transform");
      await dragBy(page, inGraph(page, "canvas-group-node"), 80, 40);
      expect(await graphNode(page, "canvas-group-node").getAttribute("transform")).not.toBe(before);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-031 拖动组内子节点后子节点位置更新", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-group", { x: 260, y: 220 });
      const group = inGraph(page, "canvas-group-node");
      const groupBox = (await group.boundingBox())!;
      const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
      await dragToGraph(page, "canvas-tool-dnd-text", {
        x: groupBox.x + groupBox.width / 2 - graphBox.x,
        y: groupBox.y + groupBox.height / 2 - graphBox.y,
      });
      const before = await graphNode(page, "canvas-text-card").getAttribute("transform");
      await dragBy(page, inGraph(page, "canvas-text-card"), 60, 30);
      expect(await graphNode(page, "canvas-text-card").getAttribute("transform")).not.toBe(before);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-032 子节点拖出组后不再跟随组移动", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-group", { x: 260, y: 220 });
      const group = inGraph(page, "canvas-group-node");
      const groupBox = (await group.boundingBox())!;
      const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
      await dragToGraph(page, "canvas-tool-dnd-text", {
        x: groupBox.x + groupBox.width / 2 - graphBox.x,
        y: groupBox.y + groupBox.height / 2 - graphBox.y,
      });
      const text = inGraph(page, "canvas-text-card");
      await dragBy(page, text, 420, 260);
      const afterDetach = await graphNode(page, "canvas-text-card").getAttribute("transform");
      await dragBy(page, group, 80, 40);
      expect(await graphNode(page, "canvas-text-card").getAttribute("transform")).toBe(afterDetach);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-033 拖动组时组内子节点跟随移动", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-group", { x: 260, y: 220 });
      const group = inGraph(page, "canvas-group-node");
      const groupBox = (await group.boundingBox())!;
      const graphBox = (await page.getByTestId("canvas-graph").boundingBox())!;
      await dragToGraph(page, "canvas-tool-dnd-text", {
        x: groupBox.x + groupBox.width / 2 - graphBox.x,
        y: groupBox.y + groupBox.height / 2 - graphBox.y,
      });
      const before = await graphNode(page, "canvas-text-card").getAttribute("transform");
      await dragBy(page, group, 80, 40);
      expect(await graphNode(page, "canvas-text-card").getAttribute("transform")).not.toBe(before);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-034 拖动节点接近对齐线后自动对齐", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 560, y: 360 });
      const cards = inGraph(page, "canvas-text-card");
      const first = (await cards.nth(0).boundingBox())!;
      const second = (await cards.nth(1).boundingBox())!;
      await dragBy(page, cards.nth(1), first.x - second.x, first.y - second.y);
      const aligned = (await cards.nth(1).boundingBox())!;
      expect(Math.abs(aligned.y - first.y)).toBeLessThan(12);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-035 拖动理解卡尺寸控制点后尺寸更新", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await page.getByTestId("canvas-toggle-library-button").click();
      const item = page.locator(
        '[data-testid="canvas-library-item"][data-understanding-title="React Server Components"]',
      );
      await expect(item).toBeVisible();
      await dragLocatorToGraph(page, item, { x: 180, y: 140 });
      const card = inGraph(page, "canvas-understanding-card");
      const before = (await card.boundingBox())!;
      await page.mouse.move(before.x + before.width, before.y + before.height);
      await page.mouse.down();
      await page.mouse.move(before.x + before.width + 80, before.y + before.height + 40, {
        steps: 10,
      });
      await page.mouse.up();
      const after = (await card.boundingBox())!;
      expect(after.width).toBeGreaterThan(before.width);
      expect(after.height).toBeGreaterThan(before.height);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-036 拖动形状尺寸控制点后尺寸更新", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-rect", { x: 220, y: 180 });
      const shape = inGraph(page, "canvas-shape-card");
      const before = (await shape.boundingBox())!;
      await page.mouse.move(before.x + before.width, before.y + before.height);
      await page.mouse.down();
      await page.mouse.move(before.x + before.width + 80, before.y + before.height + 40, {
        steps: 10,
      });
      await page.mouse.up();
      const after = (await shape.boundingBox())!;
      expect(after.width).toBeGreaterThan(before.width);
      expect(after.height).toBeGreaterThan(before.height);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-037 拖动锁定节点后位置不变", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      const card = inGraph(page, "canvas-text-card");
      await card.click({ button: "right" });
      await page.waitForTimeout(200);
      const locked = await firstNodeTransform(page);
      await dragBy(page, card, 80, 40);
      expect(await firstNodeTransform(page)).toBe(locked);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-038 拖动框选节点后所有已选节点一起移动", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 420 });
      const cards = inGraph(page, "canvas-text-card");
      const before = await Promise.all(
        Array.from({ length: await cards.count() }, (_, index) =>
          graphNode(page, "canvas-text-card", index).getAttribute("transform"),
        ),
      );
      await marqueeAll(page, cards);
      await dragBy(page, cards.nth(0), 80, 40);
      const after = await Promise.all(
        Array.from({ length: await cards.count() }, (_, index) =>
          graphNode(page, "canvas-text-card", index).getAttribute("transform"),
        ),
      );
      expect(after.every((transform, index) => transform !== before[index])).toBe(true);
    } finally {
      await app.close();
    }
  });

  test("@CV-ATOM-039 节点移动后位置写回文档", async () => {
    const { app, page } = await launchApp();
    try {
      await openWorkspace(page);
      await dragToGraph(page, "canvas-tool-dnd-text", { x: 180, y: 140 });
      await dragBy(page, inGraph(page, "canvas-text-card"), 80, 40);
      const moved = await firstNodeTransform(page);
      await waitForCanvasSave(page);
      await leaveWorkspace(page);
      await reopenWorkspace(page);
      expect(await firstNodeTransform(page)).toBe(moved);
    } finally {
      await app.close();
    }
  });
});
