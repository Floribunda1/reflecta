import { expect, test } from "@playwright/test";
import { resetAgentFixtures, seedCanvas } from "../agent/agent-fixtures";
import { launchApp } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/**
 * @CV-PERSIST-006 修改后的未保存提示与自动保存。
 * 独立文件：需要干净画布观察「未保存」→ 自动保存 → 提示消失的完整时序。
 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-save",
    title: "SAVESTATE",
    elements: [
      { id: "s_a", kind: "text", props: { text: "A" }, x: 100, y: 100, width: 140, height: 90 },
    ],
    viewport: null,
  });
  const launched = await launchApp();
  app = launched.app;
  page = launched.page;
});

test.afterAll(async () => {
  await app.close();
});

test("@CV-PERSIST-006 修改后看到未保存提示并自动保存", async () => {
  await h.openCanvasRow(page!, "SAVESTATE");
  await h.dragNodeBy(page!, "s_a", 60, 30);
  // 修改后立即出现「未保存」提示
  await expect(page!.getByText("未保存")).toBeVisible({ timeout: 3000 });
  // 自动保存（800ms 防抖 + 提交）后提示消失
  await expect(page!.getByText("未保存")).toHaveCount(0, { timeout: 6000 });
});
