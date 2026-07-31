import { expect, test } from "@playwright/test";
import { launchAgentPage, openThread } from "./agent-e2e";
import {
  assistantMessage,
  proposalPart,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-PROPOSAL-003 用户重新打开对话后仍能看到提案处理结果", async () => {
  seedAgentThread({
    id: "proposal-recovery",
    title: "已处理提案",
    messages: [
      userMessage("proposal-recovery-user", "请创建候选 Understanding"),
      assistantMessage("proposal-recovery-assistant", [
        proposalPart({
          toolCallId: "proposal-recovery-tool",
          title: "CANDIDATE_TITLE",
          state: "output-denied",
          approval: { id: "proposal-recovery-approval", approved: false },
        }),
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "已处理提案");
    const card = page.getByTestId("agent-proposal-card");
    await expect(card).toContainText("已拒绝");
    await card.getByLabel("展开 Proposal").click();
    await expect(card).toContainText("CANDIDATE_TITLE");

    await page.getByTestId("app-module-switcher").click();
    await page.getByTestId("app-module-switcher").click();
    await openThread(page, "已处理提案");
    await expect(page.getByTestId("agent-proposal-card")).toContainText("已拒绝");
  } finally {
    await app.close();
  }
});
