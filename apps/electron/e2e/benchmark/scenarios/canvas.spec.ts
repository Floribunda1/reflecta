import { expect, test, type Page } from "@playwright/test";
import { launchBench, type BenchHarness } from "../harness";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { canvasRow, openCanvasPage } from "../../acceptance/spec/canvas/canvas-e2e";
import { checkBudget, checkFrameBudget, sampleInteractions } from "../perf/budget";
import { measureStep, sampleFrames, settle, wheelScroll } from "../perf/perf-utils";

test.describe.configure({ mode: "serial" });

const TITLE = "BENCH_LARGE_CANVAS";
const NODE_COUNT = 96;

let bench: BenchHarness;
let page: Page;

test.beforeAll(async () => {
  resetAgentFixtures();
  const elements = Array.from({ length: NODE_COUNT }, (_, index) => ({
    id: `node-${index}`,
    kind: "text" as const,
    props: {
      text: `# 节点 ${index}\n\n包含 **Markdown**、列表和 \`inline code\`。\n\n- A\n- B`,
    },
    x: (index % 12) * 280,
    y: Math.floor(index / 12) * 200,
    width: 240,
    height: 160,
  }));
  const edges = Array.from({ length: NODE_COUNT - 1 }, (_, index) => ({
    id: `edge-${index}`,
    source: { cell: `node-${index}`, port: "right" as const },
    target: { cell: `node-${index + 1}`, port: "left" as const },
    router: null,
    connector: { name: "smooth" as const },
    label: `关系 ${index}`,
  }));
  seedCanvas({
    id: "bench-large-canvas",
    title: TITLE,
    elements,
    edges,
    viewport: { x: 40, y: 40, zoom: 0.2 },
  });
  bench = await launchBench();
  page = bench.page;
  await openCanvasPage(page);
});

test.afterAll(async () => {
  await bench.close();
});

test("大画布打开：节点、边与 markdown 首屏渲染", async () => {
  const run = await sampleInteractions(async () => {
    const workspace = page.getByTestId("canvas-workspace");
    if (await workspace.isVisible()) {
      await page.getByTestId("app-nav-module-capture").click();
      await expect(page.getByTestId("capture-page")).toBeVisible();
      await page.getByTestId("app-nav-module-canvas").click();
      await expect(canvasRow(page, TITLE)).toBeVisible();
      await settle(page, 100);
    }
    return measureStep(page, "open-large-canvas", async () => {
      await canvasRow(page, TITLE).click();
      await expect(page.getByTestId("canvas-graph")).toBeVisible();
      await expect(page.getByTestId("canvas-graph").locator(".react-flow__node")).toHaveCount(
        NODE_COUNT,
      );
    });
  });

  checkBudget(run, {
    elapsedMsSoft: 1500,
    longTaskCountSoft: 8,
    longTaskTotalMsSoft: 1000,
    longTaskMaxMsSoft: 250,
  });
});

test("大画布平移/缩放：React Flow 帧率", async () => {
  const graph = page.getByTestId("canvas-graph");
  const viewport = graph.locator(".react-flow__viewport");
  const box = (await graph.boundingBox())!;

  const beforePan = await viewport.getAttribute("style");
  const panFramesPromise = sampleFrames(page, 1300);
  await wheelScroll(bench.cdp, {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    deltaY: 1200,
    steps: 60,
    durationMs: 1100,
  });
  const panFrames = await panFramesPromise;
  await expect(viewport).not.toHaveAttribute("style", beforePan ?? "");
  checkFrameBudget("large-canvas-pan", panFrames, {
    p95Ms: 34,
    maxMs: 100,
    longFrameCount: 1,
  });

  const beforeZoom = await viewport.getAttribute("style");
  const zoomFramesPromise = sampleFrames(page, 900);
  for (let index = 0; index < 4; index++) {
    await page.getByTestId("canvas-zoom-in").click();
    await page.waitForTimeout(150);
  }
  const zoomFrames = await zoomFramesPromise;
  await expect(viewport).not.toHaveAttribute("style", beforeZoom ?? "");
  checkFrameBudget("large-canvas-zoom", zoomFrames, {
    p95Ms: 34,
    maxMs: 100,
    longFrameCount: 1,
  });
});
