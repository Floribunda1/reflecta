import { expect, test } from "@playwright/test";
import { launchAgentPage, launchApp, openThread } from "../../acceptance/spec/agent/agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  seedCanvas,
  seedUnderstanding,
  toolPart,
  userMessage,
} from "../../acceptance/spec/agent/agent-fixtures";
import { openCanvasPage, canvasRow } from "../../acceptance/spec/canvas/canvas-e2e";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("画布理解卡正文里的 [[u:id]] 双链解析为标题", async () => {
  seedUnderstanding({ id: "u-target", title: "目标理解", body: "这是被引用的理解。" });
  seedUnderstanding({
    id: "u-card",
    title: "卡片理解",
    body: "开头 [[u:u-target]] 结尾",
  });
  seedCanvas({
    id: "canvas-wiki-link",
    title: "WIKI_LINK_CANVAS",
    elements: [
      {
        id: "el-1",
        kind: "understanding",
        understandingId: "u-card",
        props: {},
        x: 40,
        y: 40,
        width: 240,
        height: 160,
      },
      {
        id: "el-text-1",
        kind: "text",
        props: { text: "文本里的双链：[[u:u-target]]" },
        x: 340,
        y: 40,
        width: 240,
        height: 120,
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  const { app, page } = await launchApp();
  try {
    await openCanvasPage(page);
    await canvasRow(page, "WIKI_LINK_CANVAS").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();

    // 理解卡出现在画布上，且 wiki link 显示解析后的标题
    await expect(
      page.locator('[data-testid="canvas-understanding-card"] a[data-wiki-link="u-target"]'),
    ).toHaveText(/目标理解/, { timeout: 10_000 });
    await expect(
      page.locator('[data-testid="canvas-understanding-card"] a[data-wiki-link="u-target"]'),
    ).not.toHaveText(/u-target/, { timeout: 10_000 });

    // 文本节点里的 [[u:id]] 同样解析
    await expect(
      page.locator('[data-testid="canvas-text-card"] a[data-wiki-link="u-target"]'),
    ).toHaveText(/目标理解/, { timeout: 10_000 });
    await expect(
      page.locator('[data-testid="canvas-text-card"] a[data-wiki-link="u-target"]'),
    ).not.toHaveText(/u-target/, { timeout: 10_000 });
  } finally {
    await app.close();
  }
});

test("chat canvas-view 只读画布的理解卡 [[u:id]] 也解析为标题", async () => {
  seedUnderstanding({ id: "u-target", title: "目标理解", body: "这是被引用的理解。" });
  seedUnderstanding({
    id: "u-card",
    title: "卡片理解",
    body: "开头 [[u:u-target]] 结尾",
  });
  seedAgentThread({
    id: "chat-canvas-link",
    title: "画布双链",
    messages: [
      userMessage("chat-canvas-link-user", "帮我分析一下"),
      assistantMessage("chat-canvas-link-assistant", [
        toolPart("canvas_present", "chat-canvas-link-tool", {
          kind: "canvas-view",
          version: 1,
          title: "分析画布",
          document: {
            elements: [
              {
                id: "el-c1",
                kind: "understanding",
                understandingId: "u-card",
                props: {},
                x: 40,
                y: 40,
                width: 240,
                height: 160,
              },
            ],
            edges: [],
          },
        }),
      ]),
    ],
  });

  const { app, page } = await launchAgentPage();
  try {
    await openThread(page, "画布双链");
    const view = page.getByTestId("agent-canvas-view");
    await expect(view).toBeVisible();
    await expect(
      view.locator('[data-testid="canvas-understanding-card"] a[data-wiki-link="u-target"]'),
    ).toHaveText(/目标理解/, { timeout: 10_000 });
    await expect(
      view.locator('[data-testid="canvas-understanding-card"] a[data-wiki-link="u-target"]'),
    ).not.toHaveText(/u-target/, { timeout: 10_000 });
  } finally {
    await app.close();
  }
});
