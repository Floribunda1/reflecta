import { expect, test, type Page } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import {
  canvasRow,
  graphViewportTransform,
  openCanvasPage,
} from "../../acceptance/spec/canvas/canvas-e2e";

test.beforeEach(() => {
  resetAgentFixtures();
  seedCanvas({
    id: "canvas-workspace-boundaries",
    title: "CANVAS_WORKSPACE_BOUNDARIES",
    elements: [
      { id: "text", kind: "text", props: { text: "ORIGINAL_TEXT" }, x: 100, y: 100 },
      { id: "target", kind: "text", props: { text: "TARGET_TEXT" }, x: 500, y: 320 },
    ],
    edges: [
      {
        id: "edge",
        sourceElementId: "text",
        targetElementId: "target",
        label: "EDGE_SEARCH_LABEL",
      },
    ],
  });
  seedCanvas({ id: "empty-canvas", title: "EMPTY_CANVAS" });
});

async function openWorkspace(page: Page, title = "CANVAS_WORKSPACE_BOUNDARIES") {
  await openCanvasPage(page);
  await canvasRow(page, title).click();
  await expect(page.getByTestId("canvas-workspace")).toBeVisible();
}

test("pending latest document and viewport are flushed when leaving the workspace", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page);
    const graph = page.getByTestId("canvas-graph");
    const node = graph.locator('.react-flow__node[data-id="text"]');
    await node.getByTestId("canvas-text-card").dblclick();
    const editor = node.getByRole("textbox", { name: "文本卡内容" });
    await editor.fill("INTERMEDIATE_TEXT");
    await editor.fill("LATEST_TEXT");
    await editor.blur();

    const graphBox = await graph.boundingBox();
    if (!graphBox) throw new Error("Canvas graph is not measurable");
    await page.mouse.move(graphBox.x + graphBox.width / 2, graphBox.y + graphBox.height / 2);
    await page.mouse.wheel(140, 180);
    const savedTransform = await graphViewportTransform(page).getAttribute("style");
    await page.getByTestId("canvas-workspace-back-button").click();
    await expect(page.getByTestId("canvas-page")).toBeVisible();
    await canvasRow(page, "CANVAS_WORKSPACE_BOUNDARIES").click();
    await expect(page.getByTestId("canvas-workspace")).toBeVisible();
    await expect(
      page.getByTestId("canvas-graph").getByText("LATEST_TEXT", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => graphViewportTransform(page).getAttribute("style"))
      .toBe(savedTransform);
  } finally {
    await app.close();
  }
});

test("search routes node and edge results to their distinct workspace actions", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page);
    const graph = page.getByTestId("canvas-graph");
    const beforeNodeSearch = await graphViewportTransform(page).getAttribute("style");
    await page.keyboard.press("Meta+f");
    await page.getByTestId("canvas-search-input").fill("TARGET_TEXT");
    await page.getByTestId("canvas-search-result").click();
    await expect(page.getByTestId("canvas-search-overlay")).toHaveCount(0);
    await expect
      .poll(() => graphViewportTransform(page).getAttribute("style"))
      .not.toBe(beforeNodeSearch);

    await page.keyboard.press("Meta+f");
    await page.getByTestId("canvas-search-input").fill("EDGE_SEARCH_LABEL");
    await page.getByTestId("canvas-search-result").click();
    await expect(graph.locator('.react-flow__edge[data-id="edge"]')).toHaveClass(/selected/);
    await expect(page.getByTestId("canvas-edge-style-panel")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("empty state, zoom controls, and PNG export cross the real Electron boundary", async () => {
  const { app, page } = await launchApp();
  try {
    await openWorkspace(page, "EMPTY_CANVAS");
    await expect(page.getByText("这张画布还是空的", { exact: true })).toBeVisible();
    await page.getByTestId("canvas-workspace-back-button").click();
    await canvasRow(page, "CANVAS_WORKSPACE_BOUNDARIES").click();

    const viewport = graphViewportTransform(page);
    const beforeZoom = await viewport.getAttribute("style");
    await page.getByTestId("canvas-zoom-in").click();
    await expect.poll(() => viewport.getAttribute("style")).not.toBe(beforeZoom);
    await page.getByTestId("canvas-zoom-fit").click();

    await page.evaluate(() => {
      (
        window as typeof window & { __canvasDownload?: { filename: string; href: string } }
      ).__canvasDownload = undefined;
      HTMLAnchorElement.prototype.click = function () {
        (
          window as typeof window & { __canvasDownload?: { filename: string; href: string } }
        ).__canvasDownload = {
          filename: this.download,
          href: this.href,
        };
      };
    });
    await page.getByRole("button", { name: "导出 PNG" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __canvasDownload?: { filename: string; href: string } })
              .__canvasDownload,
        ),
      )
      .toMatchObject({
        filename: "reflecta-canvas.png",
        href: expect.stringMatching(/^data:image\/png/),
      });
  } finally {
    await app.close();
  }
});
