import { describe, expect, test } from "vitest";
import {
  attachCanvasBridge,
  createCanvasBridge,
  detachCanvasBridge,
  getCanvasBridge,
} from "./canvas-bridge";

function fakeGraph() {
  return { fake: true } as unknown as import("@antv/x6").Graph;
}

describe("canvas bridge 按 graph 路由", () => {
  test("两张图各自拿到自己发布的 shapeData——同 id 节点不串台（多图并存的取数契约）", () => {
    const graphA = fakeGraph();
    const graphB = fakeGraph();
    const bridgeA = createCanvasBridge();
    const bridgeB = createCanvasBridge();
    attachCanvasBridge(graphA, bridgeA);
    attachCanvasBridge(graphB, bridgeB);

    // 两台图都有 el-irrigation（storybook fixture 复用固定 id 的场景）
    bridgeA.publish({
      shapeData: { understandingRefs: new Map(), referencedCanvases: new Map(), readonly: false },
      updateElement: () => undefined,
    });
    bridgeB.publish({
      shapeData: { understandingRefs: new Map(), referencedCanvases: new Map(), readonly: true },
      updateElement: () => undefined,
    });

    // 卡片按自己的 graph 查桥：id 撞车不影响归属
    expect(getCanvasBridge(graphA)?.get().shapeData.readonly).toBe(false);
    expect(getCanvasBridge(graphB)?.get().shapeData.readonly).toBe(true);
  });

  test("detach 后不再路由到该图", () => {
    const graph = fakeGraph();
    const bridge = createCanvasBridge();
    attachCanvasBridge(graph, bridge);
    detachCanvasBridge(graph);
    expect(getCanvasBridge(graph)).toBeUndefined();
  });

  test("publish 通知订阅者（卡片重渲染通道）", () => {
    const bridge = createCanvasBridge();
    let notified = 0;
    bridge.subscribe(() => {
      notified += 1;
    });
    bridge.publish({
      shapeData: { understandingRefs: new Map(), referencedCanvases: new Map() },
      updateElement: () => undefined,
    });
    expect(notified).toBe(1);
  });
});
