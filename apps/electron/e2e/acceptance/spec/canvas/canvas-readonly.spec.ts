import { expect, test } from "@playwright/test";
import {
  assistantMessage,
  resetAgentFixtures,
  seedAgentThread,
  seedCanvas,
  userMessage,
} from "../agent/agent-fixtures";
import { launchApp, openAgentPage, openThread } from "../agent/agent-e2e";
import * as h from "./x6-helpers";

/** 只读（对话引用入口）：禁用编辑交互、保留缩放查看、与引用卡内嵌预览同一渲染。 */
test.describe.configure({ mode: "serial" });
let app: Awaited<ReturnType<typeof launchApp>>["app"];
let page: Awaited<ReturnType<typeof launchApp>>["page"];

test.beforeAll(async () => {
  resetAgentFixtures();
  seedCanvas({
    id: "cvx-ro",
    title: "RO",
    elements: [
      {
        id: "r_a",
        kind: "text",
        props: { text: "RO_TOP" },
        x: 80,
        y: 40,
        width: 220,
        height: 80,
      },
      {
        id: "r_b",
        kind: "text",
        props: { text: "RO_MID" },
        x: 420,
        y: 220,
        width: 260,
        height: 220,
      },
      {
        id: "r_c",
        kind: "text",
        props: { text: "RO_RIGHT" },
        x: 900,
        y: 380,
        width: 220,
        height: 120,
      },
    ],
  });
  seedAgentThread({
    id: "cite-ro",
    title: "画布引用",
    entityCatalog: [
      {
        entity: { type: "canvas", id: "cvx-ro", title: "RO" },
        origin: { kind: "tool_result", toolCallId: "cite-ro", toolName: "canvas_create" },
      },
    ],
    messages: [
      userMessage("cite-ro-u", "展示画布引用"),
      assistantMessage("cite-ro-a", [
        { type: "text", text: `## 相关画布\n\n可以在这里查看 [[cv:cvx-ro]] 的只读内容。` },
      ]),
    ],
  });
  const launched = await launchApp();
  app = launched.app;
  page = launched.page;
  await openAgentPage(page!);
});
test.afterEach(async () => {
  // 让改动后的防抖保存落库，避免下一场景重进画布时读到旧文档
  if (page) await page.waitForTimeout(1400);
});

test.afterAll(async () => {
  await app?.close();
});

test("@CV-X6-RO-001 只读画布禁止编辑交互", async () => {
  await openThread(page!, "画布引用");
  const link = page!.locator('[data-slot="wiki-link"]').filter({ hasText: "RO" }).first();
  await expect(link).toBeVisible();
  await link.click();
  const dialog = page!.getByTestId("agent-canvas-dialog");
  await expect(dialog).toBeVisible();
  await expect(page!.getByTestId("agent-context-inspector")).toHaveCount(0);
  const node = dialog.locator('[data-node-id="r_a"]').first();
  await expect(node).toBeVisible();
  const dialogBox = (await dialog.boundingBox())!;
  for (const id of ["r_a", "r_b", "r_c"] as const) {
    const box = (await dialog.locator(`[data-node-id="${id}"]`).first().boundingBox())!;
    expect(box.x, `${id} left`).toBeGreaterThanOrEqual(dialogBox.x);
    expect(box.y, `${id} top`).toBeGreaterThanOrEqual(dialogBox.y);
    expect(box.x + box.width, `${id} right`).toBeLessThanOrEqual(dialogBox.x + dialogBox.width + 1);
    expect(box.y + box.height, `${id} bottom`).toBeLessThanOrEqual(
      dialogBox.y + dialogBox.height + 1,
    );
  }
  const modelBefore = await h.nodeGeometry(page!, "r_a");
  const b = (await node.boundingBox())!;
  await page!.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page!.mouse.down();
  await page!.mouse.move(b.x + b.width / 2 + 120, b.y + b.height / 2 + 60, { steps: 8 });
  await page!.mouse.up();
  await page!.waitForTimeout(300);
  // 只读：模型位置不变（画布可平移，屏幕坐标会随视口移动）
  const modelAfter = await h.nodeGeometry(page!, "r_a");
  expect(modelAfter).toEqual(modelBefore);
});

test("@CV-X6-RO-002 只读画布保留缩放查看", async () => {
  const dialog = page!.getByTestId("agent-canvas-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("canvas-zoom-controls")).toBeVisible();
  const before = await h.graphViewport(page!);
  const box = (await dialog.boundingBox())!;
  await page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page!.mouse.wheel(0, -240);
  await page!.waitForTimeout(250);
  const after = await h.graphViewport(page!);
  expect(after && after.zoom).toBeGreaterThan(before!.zoom);
});

test("@CV-X6-RO-003 各只读入口共用同一渲染", async () => {
  const dialogNode = page!
    .getByTestId("agent-canvas-dialog")
    .getByTestId("canvas-text-card")
    .first();
  await expect(dialogNode).toBeVisible();
  await expect(dialogNode).toHaveAttribute("data-node-id", "r_a");
});
