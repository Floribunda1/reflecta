import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import {
  deleteUnderstanding,
  resetAgentFixtures,
  seedCanvas,
  seedUnderstanding,
} from "../../acceptance/spec/agent/agent-fixtures";
import { leaveWorkspace, waitForCanvasSave } from "../../acceptance/spec/canvas/canvas-e2e";
import { nodeInGraph, openSeededCanvas } from "./canvas-integration";

test.beforeEach(() => {
  resetAgentFixtures();
});

/**
 * 自建节点渲染行为（nodes.tsx）：
 * - 文本卡双击编辑的提交 / 取消语义（失焦提交、Escape 取消）——acceptance 只有提交路径；
 * - 理解卡全文渲染 + 被引理解删除后的「（已删除）」占位（M3-A5，自建状态）；
 * - 画布引用卡标题 + 点击跳转（M3-E1/E3，CV-EL-005 无 acceptance 实现）；
 * - NodeResizer 最小尺寸约束（80x48，自建配置，regression 只测过 resize 本身）。
 * RF 内置的拖拽 / 命中 / 布局引擎行为不在此覆盖。
 */
test.describe("画布节点定制", () => {
  test("文本卡编辑：Escape 取消不改原文，失焦提交持久化", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [{ id: "node", kind: "text", props: { text: "ORIGINAL" }, x: 100, y: 100 }],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = nodeInGraph(page, "node").getByTestId("canvas-text-card");
      await expect(card).toContainText("ORIGINAL");

      // Escape 取消：文本回退原文
      await card.dblclick();
      const editor = nodeInGraph(page, "node").getByRole("textbox", { name: "文本卡内容" });
      await editor.fill("SHOULD_NOT_SAVE");
      await editor.press("Escape");
      await expect(card).toContainText("ORIGINAL");

      // 失焦提交：新文本生效
      await card.dblclick();
      await editor.fill("COMMITTED_TEXT");
      await editor.blur();
      await expect(card).toContainText("COMMITTED_TEXT");
    } finally {
      await app.close();
    }
  });

  test("理解卡渲染引用理解全文，被引理解删除后重进显示占位", async () => {
    seedUnderstanding({ id: "u1", title: "UNDERSTANDING_ONE", body: "BODY_FULL_TEXT" });
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        {
          id: "node",
          kind: "understanding",
          understandingId: "u1",
          x: 100,
          y: 100,
          width: 260,
          height: 160,
        },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const card = nodeInGraph(page, "node").getByTestId("canvas-understanding-card");
      await expect(card).toContainText("UNDERSTANDING_ONE");
      await expect(card).toContainText("BODY_FULL_TEXT");

      // 删除被引理解 → 重进画布 → 卡片显示占位（非正文残留）
      deleteUnderstanding("u1");
      await leaveWorkspace(page);
      await openSeededCanvas(page, "CANVAS");
      await expect(
        nodeInGraph(page, "node").getByTestId("canvas-understanding-card"),
      ).toContainText("（已删除）");
      await expect(
        nodeInGraph(page, "node").getByTestId("canvas-understanding-card"),
      ).not.toContainText("BODY_FULL_TEXT");
    } finally {
      await app.close();
    }
  });

  test("画布引用卡显示目标画布标题，点击跳转目标画布", async () => {
    seedCanvas({ id: "target-canvas", title: "TARGET_CANVAS" });
    seedCanvas({
      id: "canvas",
      title: "SOURCE_CANVAS",
      elements: [{ id: "ref", kind: "canvas_ref", canvasRefId: "target-canvas", x: 100, y: 100 }],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "SOURCE_CANVAS");
      const card = nodeInGraph(page, "ref").getByTestId("canvas-canvas-ref-card");
      await expect(card).toContainText("TARGET_CANVAS");

      await card.click();
      await expect(page.getByTestId("canvas-workspace-title-input")).toHaveValue("TARGET_CANVAS");
    } finally {
      await app.close();
    }
  });

  test("NodeResizer 强制最小尺寸 80x48", async () => {
    seedCanvas({
      id: "canvas",
      title: "CANVAS",
      elements: [
        { id: "node", kind: "text", props: { text: "T" }, x: 100, y: 100, width: 200, height: 120 },
      ],
    });
    const { app, page } = await launchApp();
    try {
      await openSeededCanvas(page, "CANVAS");
      const node = nodeInGraph(page, "node");
      await node.click();
      const handle = node.locator(".react-flow__resize-control.handle.bottom.right");
      await expect(handle).toBeVisible();

      // 拖到左上角极小位置 → 应被 min 约束钳制
      const before = (await node.boundingBox())!;
      await page.mouse.move(before.x + before.width - 4, before.y + before.height - 4);
      await page.mouse.down();
      await page.mouse.move(before.x + 4, before.y + 4, { steps: 8 });
      await page.mouse.up();
      await waitForCanvasSave(page);

      const after = (await node.boundingBox())!;
      expect(after.width).toBeGreaterThanOrEqual(80);
      expect(after.height).toBeGreaterThanOrEqual(48);
    } finally {
      await app.close();
    }
  });
});
