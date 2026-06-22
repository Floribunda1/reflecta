import { expect, test } from "@playwright/test";
import {
  assistantMessage,
  proposalPart,
  reasoningPart,
  resetAgentFixtures,
  seedAgentThread,
  toolPart,
  userMessage,
} from "./agent-fixtures";
import { launchAgentPage } from "./agent-e2e";

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
        toolPart("search_all", "result-search", { thoughts: [{ id: "thought-1" }], contexts: [] }),
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
    await expect(page.getByText("思考过程")).toBeVisible();
    await expect(page.getByText("搜索了 1 条 Thought / 0 条 Context")).toBeVisible();
    await expect(page.getByText("候选 Thought")).toBeVisible();
    await expect(page.getByText("FINAL_REPLY_BODY")).toBeVisible();

    const order = await page.locator("body").evaluate((body) => {
      const text = body.textContent ?? "";
      return [
        text.indexOf("思考过程"),
        text.indexOf("搜索了 1 条 Thought / 0 条 Context"),
        text.indexOf("候选 Thought"),
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
          output: { resultRefType: "thought", resultRefId: "approved-thought" },
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
          output: { resultRefType: "thought", resultRefId: "done-thought" },
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
