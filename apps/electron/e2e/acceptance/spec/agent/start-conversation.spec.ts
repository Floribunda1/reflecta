import { expect, test } from "@playwright/test";
import {
  composer,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  selectContext,
  threadByTitle,
  waitForAssistantReply,
} from "./agent-e2e";
import { resetAgentFixtures } from "./agent-fixtures";

test.beforeEach(() => {
  resetAgentFixtures();
});

test("@AG-START-001 用户进入 Agent 页面后可以开始对话", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await expect(page.getByTestId("agent-thread-chat")).toBeVisible();
    await expect(page.getByTestId("agent-thread-sidebar")).toBeVisible();
    await expect(composer(page)).toBeEditable();
    await expect(page.getByTestId("agent-send-button")).toBeDisabled();
  } finally {
    await app.close();
  }
});

test("@AG-START-004 新对话标题使用第一条用户消息的可读内容", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await selectContext(page, "React", "React", "domain");
    await composer(page).click();
    await page.keyboard.type("请解释这个领域");
    await page.getByTestId("agent-send-button").click();
    await expect(page.getByTestId("agent-user-message")).toContainText("React");
    await waitForAssistantReply(page);

    const title = "React 请解释这个领域";
    await expect(threadByTitle(page, title)).toBeVisible();
    await expect(threadByTitle(page, title)).not.toContainText("domain:");
  } finally {
    await app.close();
  }
});

test("@AG-START-005 对话列表只收录已经发送消息的对话", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);

    await expect(page.getByTestId("agent-thread-item").filter({ hasText: "新对话" })).toHaveCount(
      0,
    );
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-START-007 用户打开等待回复中的对话时看到对话区等待状态", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);
  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await composer(page).fill("WAITING_USER_MESSAGE：请慢慢输出 1 到 400，每个数字单独一行。");
    await page.getByTestId("agent-send-button").click();
    await createNewThread(page);
    await openThread(page, "WAITING_USER_MESSAGE");
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: "WAITING_USER_MESSAGE" }),
    ).toBeVisible();
    await expect(page.getByTestId("agent-running-placeholder")).toContainText("等待中");
    await expect(page.getByTestId("agent-empty-state")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@AG-START-008 用户收起后从导航栏恢复对话列表", async () => {
  const { app, page } = await launchAgentPage();

  try {
    await expect(page.getByTestId("agent-thread-title")).toBeVisible();
    await page.getByTestId("app-nav-rail-collapse-button").click();

    const rail = page.getByTestId("app-nav-rail");
    await expect(rail).toHaveCSS("width", "0px");
    await expect(page.getByTestId("agent-thread-sidebar")).toBeHidden();

    await page.getByTestId("app-nav-rail-collapse-button").click();
    await expect(rail).toHaveCSS("width", "248px");
    await expect(page.getByTestId("agent-thread-sidebar")).toBeVisible();
  } finally {
    await app.close();
  }
});
