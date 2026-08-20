import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { nodeInGraph, openSeededCanvas } from "./canvas-integration";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("two cards of different heights can align so their edge is straight (no corner)", async () => {
  // A：200×120，右端点中心 y = 100 + 60 = 160；C：200×100，左端点中心 y = 300 + 50 = 350。
  // 对齐需把 C 上移 190（10px snap 的整数倍）→ C.y = 110，左右端点同在 y=160。
  seedCanvas({
    id: "align",
    title: "ALIGN",
    elements: [
      { id: "a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 200, height: 120 },
      { id: "c", kind: "text", props: { text: "C" }, x: 460, y: 300, width: 200, height: 100 },
    ],
    edges: [{ id: "ac", sourceElementId: "a", targetElementId: "c" }],
  });

  const { app, page } = await launchApp();
  try {
    await openSeededCanvas(page, "ALIGN");
    const aRight = nodeInGraph(page, "a").locator(".react-flow__handle.source");
    const cLeft = nodeInGraph(page, "c").locator(".react-flow__handle.target");
    const cNode = nodeInGraph(page, "c");
    // 迭代拖动 C 直到左右端点中心在屏幕上对齐（收敛即证明 10px snap 下可对齐成直线）。
    for (let i = 0; i < 8; i++) {
      const aBox = (await aRight.boundingBox())!;
      const cBox = (await cLeft.boundingBox())!;
      const diff = aBox.y + aBox.height / 2 - (cBox.y + cBox.height / 2);
      if (Math.abs(diff) <= 2) break;
      const cn = (await cNode.boundingBox())!;
      await page.mouse.move(cn.x + cn.width / 2, cn.y + cn.height / 2);
      await page.mouse.down();
      await page.mouse.move(cn.x + cn.width / 2, cn.y + cn.height / 2 + diff, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(200);
    }

    // 直线边：bezier 路径 source 与 target 的 y 相同（无拐角）。
    const d = await page
      .getByTestId("canvas-graph")
      .locator('.react-flow__edge[data-id="ac"] .react-flow__edge-path')
      .getAttribute("d");
    const nums = (d ?? "").match(/-?[\d.]+/g)?.map(Number) ?? [];
    // d = M x1 y1 C x3 y3, x4 y4, x2 y2 → 首尾坐标
    const y1 = nums[1];
    const y2 = nums[nums.length - 1];
    expect(Math.abs(y1 - y2)).toBeLessThanOrEqual(1);
  } finally {
    await app.close();
  }
});
