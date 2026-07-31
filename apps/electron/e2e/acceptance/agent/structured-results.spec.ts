import { expect, test } from "@playwright/test";
import {
  assistantMessage,
  deleteUnderstanding,
  proposalPart,
  reasoningPart,
  resetAgentFixtures,
  seedAgentThread,
  seedContext,
  seedDomain,
  seedUnderstanding,
  seedUnderstandingIdByTitle,
  toolPart,
  userMessage,
} from "./agent-fixtures";
import { launchAgentPage, openThread } from "./agent-e2e";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-RESULT-001 用户在复杂回复中检查工作记录和最终结果", async () => {
  seedAgentThread({
    id: "result-complex",
    title: "复杂回复",
    messages: [
      userMessage("result-complex-user", "请给出复杂回复"),
      assistantMessage("result-complex-assistant", [
        reasoningPart("THINKING SUMMARY"),
        toolPart("search", "result-search", {
          hits: [{ type: "understanding", understanding: { id: "understanding-1" } }],
        }),
        proposalPart({
          toolCallId: "result-proposal",
          title: "CANDIDATE_TITLE_PENDING",
          state: "approval-requested",
          approval: { id: "result-approval" },
        }),
        { type: "text", text: "FINAL_REPLY_BODY" },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "复杂回复");
    const activityGroup = page.getByTestId("agent-activity-group");
    await expect(activityGroup).toBeVisible();
    await activityGroup.getByTestId("agent-activity-group-trigger").click();
    await expect(page.getByTestId("agent-reasoning")).toContainText("THINKING SUMMARY");
    await expect(page.getByText("搜索了 1 条 Understanding / 0 条 Context")).toBeVisible();
    await expect(page.getByTestId("agent-proposal-card")).toContainText("CANDIDATE_TITLE_PENDING");
    await expect(page.getByTestId("agent-proposal-card")).toContainText("待确认");
    await expect(page.getByText("FINAL_REPLY_BODY")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-002 用户可以区分提案的不同状态", async () => {
  seedAgentThread({
    id: "result-status",
    title: "提案状态",
    messages: [
      userMessage("result-status-user", "展示提案状态"),
      assistantMessage("result-status-assistant", [
        proposalPart({
          toolCallId: "pending-tool",
          title: "CANDIDATE_TITLE_PENDING",
          state: "approval-requested",
          approval: { id: "pending-approval" },
        }),
        proposalPart({
          toolCallId: "approved-tool",
          title: "CANDIDATE_TITLE_APPROVED",
          state: "output-available",
          approval: { id: "approved-approval", approved: true },
          output: { resultRefType: "understanding", resultRefId: "approved-understanding" },
        }),
        proposalPart({
          toolCallId: "rejected-tool",
          title: "CANDIDATE_TITLE_REJECTED",
          state: "output-denied",
          approval: { id: "rejected-approval", approved: false },
        }),
        proposalPart({
          toolCallId: "done-tool",
          title: "CANDIDATE_TITLE_DONE",
          state: "output-available",
          output: { resultRefType: "understanding", resultRefId: "done-understanding" },
        }),
        proposalPart({
          toolCallId: "error-tool",
          title: "CANDIDATE_TITLE_ERROR",
          state: "output-error",
          errorText: "RESULT_ERROR_MESSAGE",
        }),
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "提案状态");
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE_PENDING" }),
    ).toContainText("待确认");
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE_APPROVED" }),
    ).toContainText("已确认");
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "已拒绝，未写入知识库" }),
    ).toContainText("已拒绝");
    await expect(
      page
        .getByTestId("agent-proposal-card")
        .filter({ hasText: "已写入 understanding · done-understanding" }),
    ).toContainText("完成");
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE_ERROR" }),
    ).toContainText("执行失败");
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE_ERROR" }),
    ).toContainText("RESULT_ERROR_MESSAGE");
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-003 用户检查 Agent 活动的过程说明和检索结果", async () => {
  seedAgentThread({
    id: "result-expand",
    title: "展开详情",
    messages: [
      userMessage("result-expand-user", "展示可展开内容"),
      assistantMessage("result-expand-assistant", [
        reasoningPart("THINKING DETAIL"),
        toolPart(
          "search",
          "result-search",
          {
            hits: [
              {
                type: "understanding",
                understanding: { id: "u1", title: "Feedback Loop" },
                matchedText: "反馈回路能降低试错代价",
              },
            ],
          },
          { query: "代价", limit: 20 },
        ),
        { type: "text", text: "DONE" },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "展开详情");
    const activityGroup = page.getByTestId("agent-activity-group");
    const activityTrigger = activityGroup.getByTestId("agent-activity-group-trigger");

    await activityTrigger.click();
    await expect(page.getByTestId("agent-reasoning")).toContainText("THINKING DETAIL");
    const toolActivity = page.getByTestId("agent-tool-activity");
    await expect(toolActivity).toContainText("搜索「代价」");
    await expect(toolActivity).toContainText("1 条 Understanding / 0 条 Context");

    await page.getByTestId("agent-reasoning").click();
    await expect(page.getByTestId("agent-reasoning-detail")).toContainText("THINKING DETAIL");
    await toolActivity.click();
    await expect(toolActivity).toContainText("Feedback Loop");
    await expect(toolActivity).toContainText("反馈回路能降低试错代价");
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-004 用户点击 Agent 回复中的知识库引用后查看详情", async () => {
  const understandingId = seedUnderstandingIdByTitle("React Server Components");
  seedAgentThread({
    id: "result-wiki-link",
    title: "知识库引用",
    messages: [
      userMessage("result-wiki-link-user", "展示知识库引用"),
      assistantMessage("result-wiki-link-assistant", [
        { type: "text", text: `可以关联到 [[u:${understandingId}]]。` },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "知识库引用");
    await expect(page.getByText("[[React Server Components")).toHaveCount(0);
    const wikiLink = page.locator('[data-slot="wiki-link"]').filter({
      hasText: "React Server Components",
    });
    await expect(wikiLink).toBeVisible();
    await wikiLink.click();
    await expect(page.getByTestId("agent-context-inspector")).toBeVisible();
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
      { timeout: 15_000 },
    );
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-006 用户查看 Agent 最终答案中的结构化知识库引用", async () => {
  seedDomain({ id: "domain_three_views", name: "三观" });
  seedAgentThread({
    id: "result-finalizer-entity-ref",
    title: "Finalizer 引用",
    entityCatalog: [
      {
        key: "domain:domain_three_views",
        entity: { type: "domain", id: "domain_three_views", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_domain", toolName: "domain_inspect" },
      },
    ],
    messages: [
      userMessage("result-finalizer-entity-ref-user", "放在哪里"),
      assistantMessage("result-finalizer-entity-ref-assistant", [
        { type: "text", text: "可以放在 [[d:domain_three_views]] 下面。" },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "Finalizer 引用");
    const wikiLink = page.locator('[data-slot="wiki-link"]').filter({ hasText: "三观" });
    await expect(wikiLink).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-008 用户修改实体标题后历史回复显示当前标题", async () => {
  seedUnderstanding({ id: "citation-title-u", title: "旧标题", body: "正文" });
  seedAgentThread({
    id: "citation-title-thread",
    title: "引用标题更新",
    messages: [
      userMessage("citation-title-user", "回看理解"),
      assistantMessage("citation-title-assistant", [
        { type: "text", text: "参考 [[u:citation-title-u]]。" },
      ]),
    ],
  });
  let launched = await launchAgentPage();

  try {
    await openThread(launched.page, "引用标题更新");
    const citation = launched.page.locator('[data-slot="wiki-link"]');
    await expect(citation).toContainText("旧标题");
    await citation.click();
    const titleInput = launched.page.getByPlaceholder("写下一个刚形成的理解");
    await titleInput.fill("新标题");
    await titleInput.press("Tab");
    await launched.page.getByLabel("关闭详情").click();
    await expect(citation).toContainText("新标题");

    await launched.app.close();
    launched = await launchAgentPage();
    await openThread(launched.page, "引用标题更新");
    await expect(launched.page.locator('[data-slot="wiki-link"]')).toContainText("新标题");
  } finally {
    await launched.app.close();
  }
});

test("@AG-RESULT-009 用户在同一条回复中查看不同类型的知识库引用", async () => {
  seedUnderstanding({ id: "citation-mixed-u", title: "反馈循环", body: "正文" });
  seedContext({
    id: "citation-mixed-c",
    understandingId: "citation-mixed-u",
    title: "一次复盘",
    content: "具体场景",
  });
  seedDomain({ id: "citation-mixed-d", name: "产品设计" });
  seedAgentThread({
    id: "citation-mixed-thread",
    title: "三类引用",
    messages: [
      userMessage("citation-mixed-user", "展示引用"),
      assistantMessage("citation-mixed-assistant", [
        {
          type: "text",
          text: "[[u:citation-mixed-u]]、[[c:citation-mixed-c]]、[[d:citation-mixed-d]]",
        },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "三类引用");
    await expect(page.locator('[data-slot="wiki-link"]')).toHaveCount(3);
    await expect(page.getByText("反馈循环", { exact: false })).toBeVisible();
    await expect(page.getByText("一次复盘", { exact: false })).toBeVisible();
    await expect(page.getByText("产品设计", { exact: false })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-010 用户查看包含已删除实体引用的回复", async () => {
  seedUnderstanding({ id: "citation-deleted-u", title: "将被删除", body: "正文" });
  seedAgentThread({
    id: "citation-deleted-thread",
    title: "失效引用",
    messages: [
      userMessage("citation-deleted-user", "回看引用"),
      assistantMessage("citation-deleted-assistant", [
        { type: "text", text: "这段解释仍然可读，来源是 [[u:citation-deleted-u]]。" },
      ]),
    ],
  });
  deleteUnderstanding("citation-deleted-u");
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "失效引用");
    await expect(page.getByText("这段解释仍然可读", { exact: false })).toBeVisible();
    const citation = page.locator('[data-slot="wiki-link"]');
    await expect(citation).toContainText("引用不可用");
    await expect(citation).not.toHaveRole("button");
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-011 Agent 回复中的知识库引用在重新进入后保持可读", async () => {
  seedUnderstanding({ id: "citation-persist-u", title: "持久引用", body: "正文" });
  seedAgentThread({
    id: "citation-persist-thread",
    title: "引用持久化",
    messages: [
      userMessage("citation-persist-user", "展示引用"),
      assistantMessage("citation-persist-assistant", [
        { type: "text", text: "参考 [[u:citation-persist-u]]。" },
      ]),
    ],
  });
  let launched = await launchAgentPage();

  try {
    await openThread(launched.page, "引用持久化");
    await expect(launched.page.locator('[data-slot="wiki-link"]')).toContainText("持久引用");

    await openThread(launched.page, "Programming 上下文历史对话");
    await openThread(launched.page, "引用持久化");
    await expect(launched.page.locator('[data-slot="wiki-link"]')).toContainText("持久引用");

    await launched.app.close();
    launched = await launchAgentPage();
    await openThread(launched.page, "引用持久化");
    await expect(launched.page.locator('[data-slot="wiki-link"]')).toContainText("持久引用");
  } finally {
    await launched.app.close();
  }
});

test("@AG-RESULT-007 用户查看最终答案生成失败原因", async () => {
  seedAgentThread({
    id: "result-finalizer-failed",
    title: "Finalizer 失败",
    messages: [
      userMessage("result-finalizer-failed-user", "根据知识库回答"),
      assistantMessage("result-finalizer-failed-assistant", [
        {
          type: "text",
          text: "",
          state: "failed",
          error: "引用实体不存在: domain/missing",
        },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "Finalizer 失败");
    await expect(page.getByTestId("agent-final-answer-error")).toContainText(
      "引用实体不存在: domain/missing",
    );
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-012 用户查看 Agent 回复中的 Mermaid 图表", async () => {
  seedAgentThread({
    id: "result-mermaid-thread",
    title: "Mermaid 回复",
    messages: [
      userMessage("result-mermaid-user", "画出流程"),
      assistantMessage("result-mermaid-assistant", [
        { type: "text", text: "```mermaid\nflowchart LR\n  Input --> Output\n```" },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "Mermaid 回复");
    const diagram = page.locator('[data-streamdown="mermaid"]');
    await expect(diagram.locator("svg")).toBeVisible({ timeout: 15_000 });
    await diagram.hover();
    await expect(page.getByTitle("Copy Code")).toBeVisible();
    await expect(page.getByTitle("Download diagram")).toBeVisible();
    await expect(page.getByTitle("View fullscreen")).toBeVisible();
  } finally {
    await app.close();
  }
});
