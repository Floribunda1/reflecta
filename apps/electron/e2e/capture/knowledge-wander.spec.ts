import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { seedDomain } from "../agent/agent-fixtures";
import { domainNode, graphNodeCanvas, openCapturePage, visibleGraphNodePoint } from "./capture-e2e";

async function openKnowledgeWander(page: Page) {
  await openCapturePage(page);
  await page.getByTestId("capture-knowledge-wander-entry").click();
  const graph = page.getByTestId("knowledge-wander-graph");
  await expect(graph).toBeVisible();
  await expect(graph.locator(":scope > div").first()).toHaveAttribute("data-graph-ready", "true", {
    timeout: 30_000,
  });
}

test("@KW-GRAPH-011 用户从理解列表进入当前领域的知识漫步", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click();
    await page.getByTestId("capture-knowledge-wander-entry").click();

    const graphEntry = page
      .getByTestId("knowledge-wander-actions")
      .getByTestId("capture-knowledge-wander-entry");
    await expect(page.getByTestId("knowledge-wander-header")).toContainText("Programming");
    await expect(graphEntry).toHaveAttribute("aria-label", "退出知识漫步");
    await graphEntry.click();
    await expect(page.getByTestId("capture-understanding-list-header")).toContainText(
      "Programming",
    );
  } finally {
    await app.close();
  }
});

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

test("@KW-GRAPH-006 用户连续选择图谱节点并结束查看", async () => {
  test.setTimeout(60_000);
  const { app, page } = await launchApp();

  try {
    await openKnowledgeWander(page);
    const graph = page.getByTestId("knowledge-wander-graph");

    const currentNode = page.getByRole("button", {
      name: "打开理解：React Server Components",
    });
    await currentNode.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue(
      "React Server Components",
    );

    const nextNode = page.getByRole("button", { name: "打开理解：Vue Reactivity" });
    const nextId = await nextNode.getAttribute("data-node-id");
    await nextNode.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByPlaceholder("写下一个刚形成的理解")).toHaveValue("Vue Reactivity");
    await expect(graph).toHaveAttribute("data-selected-understanding-id", nextId ?? "");

    await page.getByRole("button", { name: "关闭详情" }).click();
    await expect(page.locator("#knowledge-wander-detail-panel")).toHaveCount(0);
    await expect(graph).toHaveAttribute("data-selected-understanding-id", "");
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

test("@KW-GRAPH-007 用户打开还没有 Understanding 的领域图谱", async () => {
  seedDomain({ id: "empty-domain", name: "Empty Domain" });
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Empty Domain").click();
    await page.getByTestId("capture-knowledge-wander-entry").click();

    await expect(page.getByTestId("knowledge-wander-header")).toContainText("Empty Domain");
    await expect(page.getByText("这个领域还没有理解")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@KW-GRAPH-004 用户直接调整知识漫步的图谱视口", async () => {
  const { app, page } = await launchApp();

  try {
    await openCapturePage(page);
    await domainNode(page, "Programming").click();
    await page.getByTestId("capture-knowledge-wander-entry").click();
    const graph = page.getByTestId("knowledge-wander-graph");
    await expect(graph.locator('[data-graph-ready="true"]')).toBeAttached({ timeout: 15_000 });
    const canvas = graphNodeCanvas(graph);
    await expect(canvas).toBeVisible();
    const initial = await canvas.screenshot();

    await page.getByRole("button", { name: "放大图谱" }).click();
    await expect.poll(async () => !(await canvas.screenshot()).equals(initial)).toBe(true);
    const zoomed = await canvas.screenshot();

    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Expected graph canvas bounds");
    await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.7, {
      steps: 8,
    });
    await page.mouse.up();
    await expect.poll(async () => !(await canvas.screenshot()).equals(zoomed)).toBe(true);

    const point = await visibleGraphNodePoint(page, canvas);
    await page.mouse.move(
      bounds.x + (point.x * bounds.width) / point.width,
      bounds.y + (point.y * bounds.height) / point.height,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + (point.x * bounds.width) / point.width + 50,
      bounds.y + (point.y * bounds.height) / point.height + 30,
      { steps: 8 },
    );
    await page.mouse.up();

    await page.getByRole("button", { name: "适应画布" }).click();
    await expect(graph).toHaveAttribute("data-node-count", /\d+/);
  } finally {
    await page.mouse.up().catch(() => undefined);
    await app.close();
  }
});
