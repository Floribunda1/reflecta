import { expect, test } from "@playwright/test";
import { launchAgentPage, openThread } from "../../acceptance/spec/agent/agent-e2e";
import {
  assistantMessage,
  proposalPart,
  resetAgentFixtures,
  seedAgentThread,
  userMessage,
} from "../../acceptance/spec/agent/agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
  seedAgentThread({
    id: "proposal-resize-observer-regression",
    title: "PROPOSAL_RESIZE_OBSERVER_REGRESSION",
    messages: [
      ...Array.from({ length: 3 }, (_, index) => [
        userMessage(`history-user-${index}`, `USER_${index}`),
        assistantMessage(`history-assistant-${index}`, [
          { type: "text", text: `HISTORY_${index}\n\n`.repeat(30) },
        ]),
      ]).flat(),
      userMessage("proposal-user", "请创建候选 Understanding"),
      assistantMessage("proposal-assistant", [
        proposalPart({
          toolCallId: "proposal-tool",
          title: "RESIZE_OBSERVER_PROPOSAL",
          state: "output-denied",
          approval: { id: "proposal-approval", approved: false },
        }),
      ]),
    ],
  });
});

test("展开 proposal 不触发 ResizeObserver error", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await (
      await app.browserWindow(page)
    ).evaluate((window: { unmaximize(): void; setSize(width: number, height: number): void }) => {
      window.unmaximize();
      window.setSize(900, 500);
    });
    await page.evaluate(() => {
      const errors: string[] = [];
      window.addEventListener("error", (event) => errors.push(event.message));
      (window as Window & { __proposalResizeErrors?: string[] }).__proposalResizeErrors = errors;
    });

    await openThread(page, "PROPOSAL_RESIZE_OBSERVER_REGRESSION");
    const card = page.getByTestId("agent-proposal-card");
    await expect(card).toBeVisible();
    await card.getByLabel("展开 Proposal").click();
    await page.waitForTimeout(500);

    expect(
      await page.evaluate(
        () => (window as Window & { __proposalResizeErrors?: string[] }).__proposalResizeErrors,
      ),
    ).not.toContain("ResizeObserver loop completed with undelivered notifications.");
  } finally {
    await app.close();
  }
});
