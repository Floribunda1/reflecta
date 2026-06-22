import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { getE2eElectronEnv } from "../test-env";

test("@AG-START-001 用户进入 Agent 页面后可以开始对话", async () => {
  const app = await electron.launch({
    args: [path.resolve(import.meta.dirname, "../..")],
    env: getE2eElectronEnv(),
  });

  try {
    const page = await app.firstWindow();

    await page.getByLabel("Switch module").click();
    await page.getByRole("menuitem", { name: "Agent" }).click();

    await expect(page.getByText("对话", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "新建对话" })).toBeVisible();
    await expect(page.getByText("开始和 Agent 对话")).toBeVisible();
    await expect(page.getByText("询问、比较，或 @ 引用知识库内容...")).toBeVisible();
    await expect(page.getByRole("button", { name: "发送" })).toBeDisabled();
  } finally {
    await app.close();
  }
});
