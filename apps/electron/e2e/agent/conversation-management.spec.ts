import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  composer,
  createNewThread,
  hasAi,
  launchAgentPage,
  openThread,
  sendMessage,
  threadByTitle,
  waitForAssistantReply,
} from "./agent-e2e";
import {
  assistantMessage,
  reasoningPart,
  resetAgentFixtures,
  seedAgentThread,
  seedCompletedThread,
  seedDomain,
  toolPart,
  userMessage,
} from "./agent-fixtures";
import { readE2eTestEnv, writeE2eAiConfig } from "../test-env";

test.beforeEach(() => {
  resetAgentFixtures();
});

function localIso(daysAgo: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

test("@AG-CONV-001 对话 A 正在回复时切换到对话 B 仍保持 B 的状态", async () => {
  seedAgentThread({
    id: "conv-a",
    title: "对话 A",
    messages: [
      userMessage("conv-a-user", "A_USER_MESSAGE"),
      assistantMessage("conv-a-assistant", [toolPart("search", "conv-a-tool", { hits: [] })]),
    ],
  });
  seedCompletedThread({
    id: "conv-b",
    title: "对话 B",
    userText: "B_USER_MESSAGE",
    assistantText: "B_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "对话 B");
    await expect(page.getByTestId("agent-user-message")).toContainText("B_USER_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("B_AGENT_REPLY");
    await expect(composer(page)).toBeEditable();
  } finally {
    await app.close();
  }
});

test("@AG-CONV-002 对话 A 回复完成后切回 A 可以看到 A 的内容", async () => {
  test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");
  test.setTimeout(180_000);

  seedCompletedThread({
    id: "conv-b",
    title: "对话 B",
    userText: "B_USER_MESSAGE",
    assistantText: "B_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await createNewThread(page);
    await sendMessage(page, "start A。请直接回复 AG_CONV_002_REPLY，不要调用任何工具。");
    await openThread(page, "对话 B");
    await expect(page.getByTestId("agent-user-message")).toContainText("B_USER_MESSAGE");
    await openThread(page, "start A");
    await waitForAssistantReply(page);
    await expect(page.getByTestId("agent-message-row").nth(0)).toHaveAttribute(
      "data-message-role",
      "user",
    );
    await expect(page.getByTestId("agent-message-row").nth(1)).toHaveAttribute(
      "data-message-role",
      "assistant",
    );
  } finally {
    await app.close();
  }
});

test("@AG-CONV-003 用户删除一个对话后仍可查看剩余对话", async () => {
  seedCompletedThread({
    id: "conv-a",
    title: "对话 A",
    userText: "A_USER_MESSAGE",
    assistantText: "A_AGENT_REPLY",
  });
  seedCompletedThread({
    id: "conv-b",
    title: "对话 B",
    userText: "B_USER_MESSAGE",
    assistantText: "B_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "对话 A");
    await page.getByTestId("agent-thread-actions-button").click();
    await page.getByTestId("agent-delete-thread-menu-item").click();
    await page.getByRole("button", { name: "删除" }).click();

    await expect(threadByTitle(page, "对话 A")).toHaveCount(0);
    await expect(threadByTitle(page, "对话 B")).toBeVisible();
    await openThread(page, "对话 B");
    await expect(page.getByTestId("agent-user-message")).toContainText("B_USER_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("B_AGENT_REPLY");
  } finally {
    await app.close();
  }
});

test("@AG-CONV-004 用户按时间分组查看对话列表", async () => {
  seedAgentThread({
    id: "conv-today-late",
    title: "TODAY_LATE",
    createdAt: localIso(0, 12, 10),
    updatedAt: localIso(0, 12, 10),
    messages: [userMessage("conv-today-late-user", "TODAY_LATE_MESSAGE")],
  });
  seedAgentThread({
    id: "conv-today-early",
    title: "TODAY_EARLY",
    createdAt: localIso(0, 9, 0),
    updatedAt: localIso(0, 9, 0),
    messages: [userMessage("conv-today-early-user", "TODAY_EARLY_MESSAGE")],
  });
  seedAgentThread({
    id: "conv-yesterday",
    title: "YESTERDAY_THREAD",
    createdAt: localIso(1, 12, 0),
    updatedAt: localIso(1, 12, 0),
    messages: [userMessage("conv-yesterday-user", "YESTERDAY_MESSAGE")],
  });
  const { app, page } = await launchAgentPage();

  try {
    await expect(page.getByTestId("agent-thread-group").filter({ hasText: "今天" })).toBeVisible();
    await expect(page.getByTestId("agent-thread-group").filter({ hasText: "昨天" })).toBeVisible();

    const sidebarText = await page.getByTestId("agent-thread-sidebar").innerText();
    expect(sidebarText.indexOf("TODAY_LATE")).toBeLessThan(sidebarText.indexOf("TODAY_EARLY"));
    expect(sidebarText.indexOf("TODAY_EARLY")).toBeLessThan(
      sidebarText.indexOf("YESTERDAY_THREAD"),
    );
  } finally {
    await app.close();
  }
});

test("@AG-CONV-005 用户在 Agent 回复下方 Fork 对话分支后继续查看分支点内容", async () => {
  seedAgentThread({
    id: "conv-fork-source",
    title: "FORK_SOURCE",
    createdAt: localIso(1, 9, 0),
    updatedAt: localIso(1, 9, 0),
    messages: [
      userMessage("conv-fork-user-1", "FORK_USER_MESSAGE"),
      assistantMessage("conv-fork-assistant-1", [{ type: "text", text: "FORK_AGENT_REPLY" }]),
      userMessage("conv-fork-user-2", "FORK_LATER_USER_MESSAGE"),
      assistantMessage("conv-fork-assistant-2", [{ type: "text", text: "FORK_LATER_AGENT_REPLY" }]),
    ],
  });
  seedAgentThread({
    id: "conv-fork-newer",
    title: "NEWER_THREAD",
    createdAt: localIso(0, 9, 0),
    updatedAt: localIso(0, 9, 0),
    messages: [userMessage("conv-fork-newer-user", "NEWER_THREAD_MESSAGE")],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "FORK_SOURCE");
    const firstAssistantRow = page
      .getByTestId("agent-message-row")
      .filter({ hasText: "FORK_AGENT_REPLY" })
      .first();
    await firstAssistantRow.hover();
    await firstAssistantRow.getByTestId("agent-fork-message-button").click();

    await expect(page.getByRole("button", { name: "FORK_SOURCE", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fork - FORK_SOURCE", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("agent-thread-item").first()).toHaveAttribute(
      "data-thread-title",
      "Fork - FORK_SOURCE",
    );
    await page.reload();
    await expect(page.getByTestId("agent-thread-item").first()).toHaveAttribute(
      "data-thread-title",
      "Fork - FORK_SOURCE",
    );
    await expect(page.getByTestId("agent-user-message")).toContainText("FORK_USER_MESSAGE");
    await expect(page.getByTestId("agent-assistant-text")).toContainText("FORK_AGENT_REPLY");
    await expect(
      page.getByTestId("agent-user-message").filter({ hasText: "FORK_LATER_USER_MESSAGE" }),
    ).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@AG-CONV-007 用户导出当前对话为 Markdown", async () => {
  seedDomain({ id: "domain-export", name: "EXPORT_DOMAIN" });
  seedAgentThread({
    id: "conv-export-source",
    title: "EXPORT_SOURCE",
    messages: [
      userMessage("conv-export-user", "EXPORT_USER_MESSAGE"),
      assistantMessage("conv-export-assistant", [
        reasoningPart("EXPORT_REASONING"),
        { type: "text", text: "EXPORT_AGENT_REPLY [[d:domain-export]]" },
        toolPart("search", "conv-export-tool", { markdown: "EXPORT_TOOL_OUTPUT" }),
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "EXPORT_SOURCE");
    await expect(page.getByTestId("agent-thread-title")).toHaveValue("EXPORT_SOURCE");

    const filePath = path.join(readE2eTestEnv().contentStorageRoot, "exports", "EXPORT_SOURCE.md");
    await app.evaluate(({ dialog, shell }, selectedPath) => {
      Object.defineProperty(dialog, "showSaveDialog", {
        configurable: true,
        value: async () => ({ canceled: false, filePath: selectedPath }),
      });
      Object.defineProperty(shell, "showItemInFolder", {
        configurable: true,
        value: () => undefined,
      });
    }, filePath);
    await page.getByTestId("agent-thread-actions-button").click();
    await page.getByTestId("agent-export-markdown-button").click();
    await expect.poll(() => fs.existsSync(filePath), { timeout: 15_000 }).toBe(true);
    const markdown = fs.readFileSync(filePath, "utf-8");

    expect(markdown).toContain("# EXPORT_SOURCE");
    expect(markdown).toContain("## 用户\n\nEXPORT_USER_MESSAGE");
    expect(markdown).toContain("## Agent\n\nEXPORT_AGENT_REPLY");
    expect(markdown).toContain("EXPORT_DOMAIN");
    expect(markdown).not.toContain("[[d:domain-export]]");
    expect(markdown).not.toContain("EXPORT_REASONING");
    expect(markdown).not.toContain("EXPORT_TOOL_OUTPUT");
  } finally {
    await app.close();
  }
});

test("@AG-CONV-008 用户从对话列表删除指定对话", async () => {
  seedCompletedThread({
    id: "conv-context-a",
    title: "列表对话 A",
    userText: "CONTEXT_A_USER_MESSAGE",
    assistantText: "CONTEXT_A_AGENT_REPLY",
  });
  seedCompletedThread({
    id: "conv-context-b",
    title: "列表对话 B",
    userText: "CONTEXT_B_USER_MESSAGE",
    assistantText: "CONTEXT_B_AGENT_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await threadByTitle(page, "列表对话 A").click({ button: "right" });
    const menu = page.getByTestId("agent-thread-context-menu");
    await menu.getByTestId("agent-delete-thread-menu-item").click();
    await page.getByRole("button", { name: "删除" }).click();

    await expect(threadByTitle(page, "列表对话 A")).toHaveCount(0);
    await expect(threadByTitle(page, "列表对话 B")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-CONV-009 用户重命名对话", async () => {
  seedCompletedThread({
    id: "rename-thread",
    title: "重命名前",
    userText: "RENAME_USER_MESSAGE",
    assistantText: "RENAME_AGENT_REPLY",
  });
  let launched = await launchAgentPage();

  try {
    await openThread(launched.page, "重命名前");
    await launched.page.getByTestId("agent-thread-title").fill("RENAMED_THREAD");
    await launched.page.getByTestId("agent-thread-title").press("Enter");
    await expect(threadByTitle(launched.page, "RENAMED_THREAD")).toBeVisible();

    await launched.app.close();
    launched = await launchAgentPage();
    await expect(threadByTitle(launched.page, "RENAMED_THREAD")).toBeVisible();
  } finally {
    await launched.app.close();
  }
});

test("@AG-CONV-010 用户为对话生成标题", async () => {
  expect(hasAi).toBe(true);
  seedCompletedThread({
    id: "generate-title-thread",
    title: "ORIGINAL_GENERATED_TITLE",
    userText: "请解释为什么反馈回路可以降低试错成本",
    assistantText: "反馈回路让行动结果及时回到下一轮决策。",
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "ORIGINAL_GENERATED_TITLE");
    await page.getByTestId("agent-thread-actions-button").click();
    await page.getByTestId("agent-generate-title-menu-item").click();
    await expect(page.getByText("已生成标题")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("agent-thread-title")).not.toHaveValue(
      "ORIGINAL_GENERATED_TITLE",
    );
    const nextTitle = await page.getByTestId("agent-thread-title").inputValue();
    await expect(threadByTitle(page, nextTitle)).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-CONV-011 用户归档不再活跃的对话", async () => {
  seedCompletedThread({
    id: "archive-thread-a",
    title: "归档对话 A",
    userText: "ARCHIVE_A",
    assistantText: "ARCHIVE_A_REPLY",
  });
  seedCompletedThread({
    id: "archive-thread-b",
    title: "保留对话 B",
    userText: "ARCHIVE_B",
    assistantText: "ARCHIVE_B_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await threadByTitle(page, "归档对话 A").click({ button: "right" });
    await page.getByTestId("agent-archive-thread-menu-item").click();
    await expect(threadByTitle(page, "归档对话 A")).toHaveCount(0);
    await expect(threadByTitle(page, "保留对话 B")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-CONV-012 用户复制对话 ID", async () => {
  seedCompletedThread({
    id: "copy-thread-id",
    title: "复制 ID 对话",
    userText: "COPY_ID_USER",
    assistantText: "COPY_ID_REPLY",
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "复制 ID 对话");
    await page.getByTestId("agent-thread-actions-button").click();
    await page.getByTestId("agent-copy-thread-id-menu-item").click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("copy-thread-id");
  } finally {
    await app.close();
  }
});

test("@AG-CONV-013 生成对话标题失败时保留原标题", async () => {
  seedCompletedThread({
    id: "generate-title-failure",
    title: "ORIGINAL_THREAD_TITLE",
    userText: "FAIL_TITLE_USER",
    assistantText: "FAIL_TITLE_REPLY",
  });
  writeE2eAiConfig({ ...process.env, REFLECTA_E2E_AI_API_KEY: "invalid-reflecta-e2e-key" });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "ORIGINAL_THREAD_TITLE");
    await page.getByTestId("agent-thread-actions-button").click();
    await page.getByTestId("agent-generate-title-menu-item").click();
    await expect(page.getByText("生成标题失败")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("agent-thread-title")).toHaveValue("ORIGINAL_THREAD_TITLE");
    await expect(threadByTitle(page, "ORIGINAL_THREAD_TITLE")).toBeVisible();
  } finally {
    await app.close();
  }
});
