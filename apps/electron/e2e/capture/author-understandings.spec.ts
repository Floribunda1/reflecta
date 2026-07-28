import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
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
    await page.getByRole("article").getByRole("button", { name: "删除" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();

    await expect(understandingRow(page, "React Server Components")).toHaveCount(0);
    await expect(understandingRow(page, "Vue Reactivity")).toBeVisible();
    await expect(page.getByText("选择一条内容开始查看")).toBeVisible();
  } finally {
    await app.close();
  }
});
