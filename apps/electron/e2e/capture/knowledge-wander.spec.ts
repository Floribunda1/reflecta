import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { domainNode, openCapturePage } from "./capture-e2e";

async function openKnowledgeWander(page: Page) {
  await openCapturePage(page);
  await page.getByTestId("capture-knowledge-wander-entry").click();
  await expect(page.getByTestId("knowledge-wander-graph")).toBeVisible();
}

test("@KW-GRAPH-001 用户打开全部领域图谱", async () => {
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page);

    const graph = page.getByTestId("knowledge-wander-graph");
    await expect(page.getByTestId("knowledge-wander-header")).toContainText("全部领域");
    await expect(graph.locator("canvas").first()).toBeVisible();

    const nodeCount = Number(await graph.getAttribute("data-node-count"));
    const edgeCount = Number(await graph.getAttribute("data-edge-count"));
    expect(nodeCount).toBeGreaterThan(0);
    expect(edgeCount).toBeGreaterThan(0);
    await expect(graph.locator("button[data-node-id]")).toHaveCount(nodeCount);
    expect(await graph.locator('button[data-node-degree="0"]').count()).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});

test("@KW-GRAPH-002 用户从图谱节点进入理解详情并返回", async () => {
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page);

    const graph = page.getByTestId("knowledge-wander-graph");
    const node = graph.getByRole("button", {
      name: "打开理解：React Server Components",
    });
    const understandingId = await node.getAttribute("data-node-id");
    const canvas = await graph.locator("canvas").first().elementHandle();
    if (!understandingId || !canvas) throw new Error("Expected graph node and canvas");

    await node.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
    );
    await expect(graph).toHaveAttribute("data-selected-understanding-id", understandingId);

    await page.getByRole("button", { name: "关闭详情" }).click();

    await expect(page.getByRole("button", { name: "关闭详情" })).toBeHidden();
    await expect(graph).toHaveAttribute("data-selected-understanding-id", "");
    expect(await canvas.evaluate((element) => document.contains(element))).toBe(true);
  } finally {
    await app.close();
  }
});

test("@KW-GRAPH-003 用户切换图谱的领域范围", async () => {
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page);

    const graph = page.getByTestId("knowledge-wander-graph");
    const allNodeCount = Number(await graph.getAttribute("data-node-count"));
    await domainNode(page, "Programming").click();

    await expect(page.getByTestId("knowledge-wander-header")).toContainText("Programming");
    await expect
      .poll(async () => Number(await graph.getAttribute("data-node-count")))
      .toBeLessThan(allNodeCount);
    const scopedNodeCount = Number(await graph.getAttribute("data-node-count"));
    expect(scopedNodeCount).toBeGreaterThan(0);
    await expect(graph.locator("button[data-node-id]")).toHaveCount(scopedNodeCount);
  } finally {
    await app.close();
  }
});

test("@KW-GRAPH-004 用户从旧 Contemplate 地址回到 Capture", async () => {
  const { app, page } = await launchApp();

  try {
    await page.evaluate(() => {
      window.location.hash = "#/contemplate";
    });

    await expect(page.getByTestId("capture-page")).toBeVisible();
    await page.getByLabel("Switch module").click();
    await expect(page.getByRole("menuitem", { name: "Capture" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Agent" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Contemplate/i })).toHaveCount(0);
  } finally {
    await app.close();
  }
});
