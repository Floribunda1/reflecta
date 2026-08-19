import { expect, test } from "@playwright/test";
import { launchAgentPage, openThread } from "../agent/agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  seedCanvas,
  userMessage,
} from "../agent/agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@CV-CIT-001 用户在对话中点击画布引用以只读查看", async () => {
  const canvasId = "seed-canvas-citation-1";
  seedCanvas({ id: canvasId, title: "理解画布" });
  seedAgentThread({
    id: "canvas-citation-1",
    title: "画布引用",
    entityCatalog: [
      {
        entity: { type: "canvas", id: canvasId, title: "理解画布" },
        origin: {
          kind: "tool_result",
          toolCallId: "canvas-citation-tool",
          toolName: "canvas_create",
        },
      },
    ],
    messages: [
      userMessage("canvas-citation-user", "展示画布引用"),
      assistantMessage("canvas-citation-assistant", [
        { type: "text", text: `## 相关画布\n\n可以在这里查看 [[cv:${canvasId}]] 的只读内容。` },
      ]),
    ],
  });

  const { app, page } = await launchAgentPage();
  try {
    await expect(page.getByTestId("agent-message-list")).toBeVisible();
    await openThread(page, "画布引用");
    await expect(page.locator("h2", { hasText: "相关画布" })).toBeVisible();

    const link = page.locator('[data-slot="wiki-link"]').filter({ hasText: "理解画布" }).first();
    await expect(link).toBeVisible();

    await link.click();
    await expect(page.getByTestId("agent-context-inspector")).toBeVisible();
    // 只读画布（CanvasReadOnlyView 的 React Flow 图）渲染，且无编辑交互
    await expect(
      page.getByTestId("agent-context-inspector").locator(".react-flow__graph").first(),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});
