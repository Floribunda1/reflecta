import { expect, test } from "@playwright/test";
import { launchAgentPage, openThread } from "../../acceptance/spec/agent/agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  seedCanvas,
  userMessage,
} from "../../acceptance/spec/agent/agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

/**
 * 只读画布渲染（CanvasReadOnlyView → CanvasGraph readOnly）：
 * 入口在 Agent「画布引用」弹窗（M8-6），但被测行为是画布组件的只读定制：
 * - 隐藏 MiniMap；
 * - 节点不可拖动（nodesDraggable=false）；
 * - 文本卡双击不进入编辑（内容编辑入口全部关闭）；
 * - Backspace 不删除（deleteKeyCode=null）。
 * 平移/缩放等查看能力保留（这是只读渲染的既有语义）。
 */
test.describe("画布只读模式", () => {
  test("只读画布：无缩略图、节点不可拖、双击不编辑、Backspace 不删", async () => {
    const canvasId = "readonly-canvas-1";
    seedCanvas({
      id: canvasId,
      title: "只读画布",
      elements: [
        {
          id: "text",
          kind: "text",
          props: { text: "READONLY_BODY" },
          x: 100,
          y: 100,
          width: 200,
          height: 120,
        },
      ],
    });
    seedAgentThread({
      id: "readonly-thread-1",
      title: "只读画布引用",
      entityCatalog: [
        {
          entity: { type: "canvas", id: canvasId, title: "只读画布" },
          origin: {
            kind: "tool_result",
            toolCallId: "readonly-canvas-tool",
            toolName: "canvas_create",
          },
        },
      ],
      messages: [
        userMessage("readonly-user", "展示画布"),
        assistantMessage("readonly-assistant", [
          {
            type: "text",
            text: `## 画布\n\n[[cv:${canvasId}]]`,
          },
        ]),
      ],
    });

    const { app, page } = await launchAgentPage();
    try {
      await openThread(page, "只读画布引用");
      const link = page.locator('[data-slot="wiki-link"]').filter({ hasText: "只读画布" }).first();
      await expect(link).toBeVisible();
      await link.click();

      const inspector = page.getByTestId("agent-context-inspector");
      await expect(inspector.locator(".react-flow__viewport").first()).toBeVisible();

      // 只读：不渲染 MiniMap
      await expect(inspector.locator(".react-flow__minimap")).toHaveCount(0);

      // 只读：节点不可拖动（画布内位置不变；只读节点 pointer-events:none，RF 不处理 drag）
      const node = inspector.locator(".react-flow__node").first();
      await expect(node).toBeVisible();
      const beforeTransform = await node.getAttribute("style");
      const box = (await node.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 });
      await page.mouse.up();
      await expect(node).toHaveAttribute("style", beforeTransform);

      // 只读：文本卡双击不进入编辑（只读节点 pointer-events:none，用原始 mouse 事件验证）
      const cardBox = (await node.boundingBox())!;
      await page.mouse.dblclick(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.waitForTimeout(200);
      await expect(inspector.getByRole("textbox", { name: "文本卡内容" })).toHaveCount(0);
      await expect(node.getByTestId("canvas-text-card")).toContainText("READONLY_BODY");

      // 只读：Backspace 不删除节点
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(200);
      await expect(inspector.locator(".react-flow__node")).toHaveCount(1);
    } finally {
      await app.close();
    }
  });
});
