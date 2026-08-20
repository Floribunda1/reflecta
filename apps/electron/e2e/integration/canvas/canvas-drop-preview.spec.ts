import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures, seedCanvas } from "../../acceptance/spec/agent/agent-fixtures";
import { openSeededCanvas } from "./canvas-integration";

const MIME = "application/reflecta-canvas-element";

test.beforeEach(() => {
  resetAgentFixtures();
  seedCanvas({ id: "drop-preview", title: "DROP_PREVIEW", elements: [] });
});

/**
 * 走真实链路验证落点预览：
 * 1) 在真实拖拽源（工具栏文本按钮）上触发 dragstart → 写入 dataTransfer + 暂存元素；
 *    （getData 在 dragover 阶段读不到，预览要素来自暂存）
 * 2) 在画布 pane 上 dragover → 出现跟随光标的占位预览；
 * 3) drop → 预览消失、节点落位。
 */
test("dragging a canvas element over the graph shows a live drop target preview", async () => {
  const { app, page } = await launchApp();
  try {
    await openSeededCanvas(page, "DROP_PREVIEW");
    const graph = page.getByTestId("canvas-graph");
    await expect(page.getByTestId("canvas-tool-dnd-text")).toBeVisible();

    // 触发真实 dragstart（React 的 onDragStart → setData + setDndElement），dataTransfer 存于 window。
    await page.evaluate((mime) => {
      const dt = new DataTransfer();
      const source = document.querySelector('[data-testid="canvas-tool-dnd-text"]') as HTMLElement;
      source.dispatchEvent(
        new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      (window as unknown as Record<string, unknown>).__df = { dt, mime };
    }, MIME);

    // dragover 到画布 pane 内
    await page.evaluate(() => {
      const { dt, mime } = (window as unknown as Record<string, { dt: DataTransfer; mime: string }>)
        .__df;
      const pane = document.querySelector(
        '[data-testid="canvas-graph"] .react-flow__pane',
      ) as HTMLElement;
      const rect = pane.getBoundingClientRect();
      void mime;
      const x = rect.left + 160;
      const y = rect.top + 120;
      const over = (type: string) =>
        pane.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: x,
            clientY: y,
          }),
        );
      over("dragenter");
      over("dragover");
    });

    // 预览出现（尺寸 = 元素宽高，zoom=1）
    const preview = graph.getByTestId("canvas-drop-preview");
    await expect(preview).toHaveCSS("opacity", "1");
    const size = await preview.boundingBox();
    expect(size!.width).toBeCloseTo(220, 1);
    expect(size!.height).toBeCloseTo(120, 1);

    // drop：预览消失，节点落位
    await page.evaluate(() => {
      const { dt } = (window as unknown as Record<string, { dt: DataTransfer }>).__df;
      const pane = document.querySelector(
        '[data-testid="canvas-graph"] .react-flow__pane',
      ) as HTMLElement;
      const rect = pane.getBoundingClientRect();
      pane.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: rect.left + 160,
          clientY: rect.top + 120,
        }),
      );
    });
    await expect(preview).toHaveCSS("opacity", "0");
    await expect(page.getByTestId("canvas-graph").getByTestId("canvas-text-card")).toHaveCount(1);
  } finally {
    await app.close();
  }
});
