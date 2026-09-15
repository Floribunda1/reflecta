import { expect, test } from "@playwright/test";
import { launchAgentPage, openThread } from "../../acceptance/spec/agent/agent-e2e";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  seedUnderstanding,
  toolPart,
  userMessage,
} from "../../acceptance/spec/agent/agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("chat 里 canvas-view 的 wiki link 点击打开右侧 inspector（与正文点实体一致）", async () => {
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
    // canvas_present 首次展示默认折叠：正文里的双链要先展开卡片
    await view.getByTestId("canvas-understanding-collapse").first().click();
    await expect(
      view.locator('[data-testid="canvas-understanding-card"] a[data-wiki-link="u-target"]'),
    ).toHaveText(/目标理解/, { timeout: 10_000 });

    // 点击理解双链 → 打开 Chat 右侧 inspector（与 Chat 正文点实体一致）
    await view
      .locator('[data-testid="canvas-understanding-card"] a[data-wiki-link="u-target"]')
      .click();
    await expect(page.getByTestId("agent-context-inspector")).toBeVisible();
    await expect(page.getByTestId("agent-context-inspector")).toContainText("这是被引用的理解。");
  } finally {
    await app.close();
  }
});
