import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { seedUnderstanding, understandingExistsByTitle } from "../agent/agent-fixtures";
import {
  domainNode,
  openCapturePage,
  openUnderstanding,
  understandingEditor,
  understandingRow,
  understandingTitleInput,
} from "./capture-e2e";

test("@CP-UNDERSTANDING-001 用户在当前 Domain 下新建 Understanding", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click();
    await page.getByRole("button", { name: "新建理解" }).click();

    await understandingTitleInput(page).fill("NEW_UNDERSTANDING_TITLE");
    await understandingEditor(page).click();
    await understandingEditor(page).fill("NEW_UNDERSTANDING_BODY");
    await expect(understandingEditor(page)).toContainText("NEW_UNDERSTANDING_BODY");
    await understandingEditor(page).press("Tab");
    await expect.poll(() => understandingExistsByTitle("NEW_UNDERSTANDING_TITLE")).toBe(true);
    await openUnderstanding(page, "React Server Components");
    await openUnderstanding(page, "NEW_UNDERSTANDING_TITLE");

    await expect(understandingEditor(page)).toContainText("NEW_UNDERSTANDING_BODY");
    await expect(page.getByRole("button", { name: /Programming/ })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CP-UNDERSTANDING-002 用户修改已有 Understanding 后重新打开仍看到修改", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");
    await understandingTitleInput(page).fill("UPDATED_UNDERSTANDING_TITLE");
    await understandingEditor(page).click();
    await page.keyboard.press("Meta+a");
    await understandingEditor(page).pressSequentially("UPDATED_UNDERSTANDING_BODY");
    await expect(understandingEditor(page)).toContainText("UPDATED_UNDERSTANDING_BODY");
    await understandingTitleInput(page).click();
    await expect.poll(() => understandingExistsByTitle("UPDATED_UNDERSTANDING_TITLE")).toBe(true);

    await openUnderstanding(page, "Vue Reactivity");
    await openUnderstanding(page, "UPDATED_UNDERSTANDING_TITLE");
    await expect(understandingEditor(page)).toContainText("UPDATED_UNDERSTANDING_BODY");
  } finally {
    await app.close();
  }
});

test("@CP-UNDERSTANDING-003 用户调整 Understanding 所属的 Domain", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Design", exact: true }).click();
    await expect(page.getByRole("button", { name: /Design/ })).toBeVisible();

    await domainNode(page, "Design").click();
    await expect(understandingRow(page, "React Server Components")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CP-UNDERSTANDING-004 用户删除不再需要的 Understanding", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");
    await page.getByRole("article").getByRole("button", { name: "更多操作" }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();

    await expect(understandingRow(page, "React Server Components")).toHaveCount(0);
    await expect(understandingRow(page, "Vue Reactivity")).toBeVisible();
    await expect(page.getByText("选择一条内容开始查看")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CP-UNDERSTANDING-005 用户查看 Understanding 中的 Mermaid 图表", async () => {
  seedUnderstanding({
    id: "mermaid-understanding",
    title: "Mermaid Understanding",
    body: "```mermaid\nflowchart LR\n  Input --> Output\n```",
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "Mermaid Understanding");
    const editor = understandingEditor(page);
    await expect(editor.locator("svg").filter({ hasText: "Input" })).toBeVisible({
      timeout: 15_000,
    });

    await openUnderstanding(page, "Vue Reactivity");
    await openUnderstanding(page, "Mermaid Understanding");
    await expect(understandingEditor(page).locator("svg").filter({ hasText: "Input" })).toBeVisible(
      {
        timeout: 15_000,
      },
    );
  } finally {
    await app.close();
  }
});

test("@CP-UNDERSTANDING-006 Mermaid 图表无效时用户仍能继续修改正文", async () => {
  seedUnderstanding({
    id: "invalid-mermaid-understanding",
    title: "Invalid Mermaid Understanding",
    body: "```mermaid\nflowchart INVALID\n  A -->\n```\n\n仍可编辑",
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "Invalid Mermaid Understanding");
    const editor = understandingEditor(page);
    await expect(editor.locator(".reflecta-mermaid-error")).toContainText("Mermaid 图表渲染失败", {
      timeout: 15_000,
    });
    await expect(editor.locator(".cm-content").first()).toBeEditable();
    await editor.getByText("仍可编辑").click();
    await page.keyboard.press("End");
    await page.keyboard.type("正文");
    await expect(editor).toContainText("仍可编辑正文");
  } finally {
    await app.close();
  }
});
