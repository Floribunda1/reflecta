import { expect, test } from "@playwright/test";
import {
  assistantMessage,
  proposalPart,
  reasoningPart,
  resetAgentFixtures,
  seedAgentThread,
  seedUnderstandingIdByTitle,
  toolPart,
  userMessage,
} from "./agent-fixtures";
import { launchAgentPage, openThread } from "./agent-e2e";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-RESULT-001 用户查看复杂回复时内容按发生顺序显示", async () => {
  seedAgentThread({
    id: "result-complex",
    title: "复杂回复",
    messages: [
      userMessage("result-complex-user", "请给出复杂回复"),
      assistantMessage("result-complex-assistant", [
        reasoningPart("THINKING_SUMMARY"),
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
    await expect(page.getByText("思考过程")).toBeVisible();
    await expect(page.getByText("搜索了 1 条 Understanding / 0 条 Context")).toBeVisible();
    await expect(page.getByText("候选 Understanding")).toBeVisible();
    await expect(page.getByText("FINAL_REPLY_BODY")).toBeVisible();

    const order = await page.locator("body").evaluate((body) => {
      const text = body.textContent ?? "";
      return [
        text.indexOf("思考过程"),
        text.indexOf("搜索了 1 条 Understanding / 0 条 Context"),
        text.indexOf("候选 Understanding"),
        text.indexOf("FINAL_REPLY_BODY"),
      ];
    });
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
    expect(order[2]).toBeLessThan(order[3]);
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
      page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE_REJECTED" }),
    ).toContainText("已拒绝");
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE_DONE" }),
    ).toContainText("完成");
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE_ERROR" }),
    ).toContainText("出错");
    await expect(
      page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE_ERROR" }),
    ).toContainText("RESULT_ERROR_MESSAGE");
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-003 用户展开思考过程和工具活动查看详情", async () => {
  seedAgentThread({
    id: "result-expand",
    title: "展开详情",
    messages: [
      userMessage("result-expand-user", "展示可展开内容"),
      assistantMessage("result-expand-assistant", [
        reasoningPart("THINKING_DETAIL"),
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
    await expect(page.getByTestId("agent-reasoning")).toContainText("思考过程");
    await expect(page.getByText("THINKING_DETAIL")).toHaveCount(0);
    await expect(page.getByText("搜索「代价」 · 1 条 Understanding / 0 条 Context")).toBeVisible();
    await expect(page.getByText("搜索相关内容", { exact: true })).toHaveCount(0);
    await expect(page.getByText("查询：代价")).toHaveCount(0);

    await page.getByTestId("agent-reasoning").getByText("思考过程").click();
    await page
      .getByTestId("agent-tool-activity")
      .getByText("搜索「代价」 · 1 条 Understanding / 0 条 Context")
      .click();

    const toolActivity = page.getByTestId("agent-tool-activity");
    await expect(page.getByText("THINKING_DETAIL")).toBeVisible();
    await expect(toolActivity.getByText("查询：代价")).toBeVisible();
    await expect(toolActivity.getByText("Understanding", { exact: true })).toBeVisible();
    await expect(toolActivity.getByText("Feedback Loop")).toBeVisible();
    await expect(toolActivity.getByText("反馈回路能降低试错代价")).toBeVisible();
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
        { type: "text", text: `可以关联到 [[React Server Components#${understandingId}]]。` },
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
