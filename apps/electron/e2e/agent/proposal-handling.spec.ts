import { expect, test } from "@playwright/test";
import { hasAi, launchAgentPage, openThread } from "./agent-e2e";
import {
  assistantMessage,
  proposalPart,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "./agent-fixtures";

function seedPendingProposal() {
  seedAgentThread({
    id: "proposal-pending",
    title: "候选 Thought 提案",
    messages: [
      userMessage("proposal-user", "请创建候选 Thought"),
      assistantMessage("proposal-assistant", [
        proposalPart({
          toolCallId: "proposal-tool",
          title: "CANDIDATE_TITLE",
          state: "approval-requested",
          approval: { id: "proposal-approval" },
        }),
      ]),
    ],
  });
}

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-PROPOSAL-001 用户确认候选 Thought 后看到执行结果", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  seedPendingProposal();
  const { app, page } = await launchAgentPage();

  try {
    const card = page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE" });
    await card.getByTestId("agent-proposal-confirm-button").click();
    await expect(card).toContainText("已确认", { timeout: 120_000 });
    await expect(card).toContainText(/已写入|已确认/);
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-002 用户拒绝候选 Thought 后看到拒绝结果", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  seedPendingProposal();
  const { app, page } = await launchAgentPage();

  try {
    const card = page.getByTestId("agent-proposal-card").filter({ hasText: "CANDIDATE_TITLE" });
    await card.getByTestId("agent-proposal-reject-button").click();
    await expect(card).toContainText("已拒绝", { timeout: 120_000 });
    await expect(card).toContainText("未写入知识库");
  } finally {
    await app.close();
  }
});

test("@AG-PROPOSAL-003 用户重新打开对话后仍能看到提案处理结果", async () => {
  seedAgentThread({
    id: "proposal-recovery",
    title: "已处理提案",
    messages: [
      userMessage("proposal-recovery-user", "请创建候选 Thought"),
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
    await expect(page.getByTestId("agent-proposal-card")).toContainText("CANDIDATE_TITLE");
    await expect(page.getByTestId("agent-proposal-card")).toContainText("已拒绝");

    await page.getByLabel("Switch module").click();
    await page.getByRole("menuitem", { name: "Capture" }).click();
    await page.getByLabel("Switch module").click();
    await page.getByRole("menuitem", { name: "Agent" }).click();
    await openThread(page, "已处理提案");
    await expect(page.getByTestId("agent-proposal-card")).toContainText("已拒绝");
  } finally {
    await app.close();
  }
});
