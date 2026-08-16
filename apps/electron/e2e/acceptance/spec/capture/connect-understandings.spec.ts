import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import {
  seedUnderstanding,
  seedUnderstandingIdByTitle,
  understandingBodyByTitle,
} from "../agent/agent-fixtures";
import {
  openCapturePage,
  openUnderstanding,
  understandingEditor,
  understandingRow,
  understandingTitleInput,
} from "./capture-e2e";

async function connectToUnconnectedNode(page: Page) {
  await openUnderstanding(page, "React Server Components");
  const editor = understandingEditor(page);
  await editor.click();
  await page.keyboard.press("Meta+ArrowDown");
  await editor.pressSequentially("\n\n[[Unconnected");
  const targetId = seedUnderstandingIdByTitle("Unconnected Node");
  await expect(page.getByRole("option", { name: /Unconnected Node/ })).toBeVisible();
  await editor.press("Enter");
  await expect(editor.locator(`a[data-wiki-link="${targetId}"]`)).toBeVisible();
  await understandingTitleInput(page).click();
  await expect
    .poll(() => understandingBodyByTitle("React Server Components"))
    .toContain(`[[u:${targetId}]]`);
}

test("@CP-CONNECTION-001 用户通过 wiki-link 连接另一条 Understanding", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await connectToUnconnectedNode(page);
    await openUnderstanding(page, "Vue Reactivity");
    await openUnderstanding(page, "React Server Components");

    await expect(
      understandingEditor(page)
        .locator("a[data-wiki-link]")
        .filter({ hasText: "Unconnected Node" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@CP-CONNECTION-002 用户从 wiki-link 打开被引用的 Understanding", async () => {
  const sourceId = seedUnderstandingIdByTitle("React Server Components");
  const targetId = seedUnderstandingIdByTitle("React Suspense");
  seedUnderstanding({
    id: sourceId,
    title: "React Server Components",
    body: `RSC links to [[u:${targetId}]].`,
  });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await openUnderstanding(page, "React Server Components");
    await understandingEditor(page)
      .locator("a[data-wiki-link]")
      .filter({ hasText: "React Suspense" })
      .click();

    await expect(understandingTitleInput(page)).toHaveValue("React Suspense");
    await expect(understandingRow(page, "React Suspense")).toHaveAttribute("aria-current", "true");
  } finally {
    await app.close();
  }
});

test("@CP-CONNECTION-003 用户建立 Connection 后理解列表显示引用数量", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    const connectionCount = async () => {
      const badge = understandingRow(page, "React Server Components").getByLabel(/条引用/);
      return Number((await badge.getAttribute("aria-label"))?.match(/\d+/)?.[0] ?? "0");
    };
    const before = await connectionCount();

    await connectToUnconnectedNode(page);

    await expect.poll(connectionCount).toBe(before + 1);
  } finally {
    await app.close();
  }
});
