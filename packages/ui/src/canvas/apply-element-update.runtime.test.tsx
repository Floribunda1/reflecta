// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import { Graph, Node } from "@antv/x6";
import { nodeMetadataFor, applyElementUpdate } from "./graph-document";
import type { CanvasElementDTO } from "@reflecta/shared";

Node.define({
  shape: "text",
  inherit: "rect",
  ports: { groups: { default: { position: "left", attrs: { circle: { r: 4, magnet: true } } } } },
});

function makeNode(color?: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const graph = new Graph({ container, async: false, virtual: false, autoResize: false });
  const element: CanvasElementDTO = {
    id: "n1",
    canvasId: "c",
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    parentId: null,
    x: 10,
    y: 10,
    width: 100,
    height: 60,
    zIndex: 0,
    createdAt: "t",
    updatedAt: "t",
    props: { text: "x", ...(color ? { color } : {}) },
  };
  const node = graph.addNode(nodeMetadataFor(element)) as import("@antv/x6").Node;
  return { graph, node, element, container };
}

const paintStyle = (node: import("@antv/x6").Node) =>
  (node.getAttrs().root as { style?: Record<string, unknown> } | undefined)?.style?.[
    "--canvas-node-paint"
  ];

describe("applyElementUpdate runtime behavior", () => {
  test("painting sets the variable, clearing falls back to ring, graph stays intact", () => {
    const { graph, node, element, container } = makeNode();
    try {
      applyElementUpdate(node, { ...element, props: { ...element.props, color: "chart-2" } });
      expect(paintStyle(node)).toBe("var(--chart-2)");
      // 清除颜色 → 写 var(--ring)（不删键：删除会走 dirty 强制重渲染）
      applyElementUpdate(node, { ...element, props: { text: "x" } });
      expect(paintStyle(node)).toBe("var(--ring)");
      // 视口 / 连接 / 渲染不被打乱
      expect(graph.getCells().length).toBe(1);
      expect(graph.getCellById("n1")).toBe(node);
      expect(node.getPorts().length).toBeGreaterThan(0);
    } finally {
      graph.dispose();
      container.remove();
    }
  });

  test("color unchanged does not touch attrs", () => {
    const { graph, node, element, container } = makeNode();
    try {
      const before = node.getAttrs();
      applyElementUpdate(node, { ...element, props: { ...element.props, text: "y" } });
      expect(node.getAttrs()).toEqual(before);
    } finally {
      graph.dispose();
      container.remove();
    }
  });
});
