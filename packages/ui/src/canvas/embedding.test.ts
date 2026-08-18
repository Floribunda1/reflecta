// @vitest-environment happy-dom

import { Graph } from "@antv/x6";
import { describe, expect, test } from "vitest";
import { documentToGraphData, elementToNodeMeta, graphToDocument } from "./graph-document";
import { shapeNameForKind } from "./shapes/shape-registry";
import type { CanvasDocument } from "./document";

function groupElement() {
  return {
    id: "group-1",
    canvasId: "c",
    parentId: null,
    x: 0,
    y: 0,
    width: 320,
    height: 240,
    zIndex: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    kind: "group",
    understandingId: null,
    canvasRefId: null,
    props: { label: "组" },
  } as const;
}

function textElement(id: string) {
  return {
    id,
    canvasId: "c",
    parentId: null,
    x: 40,
    y: 40,
    width: 220,
    height: 120,
    zIndex: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: { text: "hi" },
  } as const;
}

function makeGraph() {
  return new Graph({
    container: document.createElement("div"),
    width: 800,
    height: 600,
    background: false,
    grid: false,
  });
}

describe("embedding 语义（M3-D）", () => {
  test("入组：insertChild 建立父级，文档回写反映 parentId", () => {
    const graph = makeGraph();
    const group = graph.addNode(elementToNodeMeta(groupElement(), shapeNameForKind("group")));
    const text = graph.addNode(elementToNodeMeta(textElement("text-1"), shapeNameForKind("text")));

    group.insertChild(text);

    expect(text.getParent()?.id).toBe("group-1");
    const document = graphToDocument(graph);
    const textDoc = document.elements.find((e) => e.id === "text-1");
    expect(textDoc?.parentId).toBe("group-1");
    graph.dispose();
  });

  test("出组：unembed 清空父级且元素保留", () => {
    const graph = makeGraph();
    const group = graph.addNode(elementToNodeMeta(groupElement(), shapeNameForKind("group")));
    const text = graph.addNode(elementToNodeMeta(textElement("text-1"), shapeNameForKind("text")));
    group.insertChild(text);

    group.unembed(text);

    expect(text.getParent()).toBeNull();
    expect(graph.getCellById("text-1")).toBeTruthy();
    graph.dispose();
  });

  test("级联删除：remove({deep}) 连组内元素一并移除", () => {
    const graph = makeGraph();
    const group = graph.addNode(elementToNodeMeta(groupElement(), shapeNameForKind("group")));
    const text = graph.addNode(elementToNodeMeta(textElement("text-1"), shapeNameForKind("text")));
    group.insertChild(text);

    group.remove({ deep: true });

    expect(graph.getCellById("group-1")).toBeFalsy();
    expect(graph.getCellById("text-1")).toBeFalsy();
    graph.dispose();
  });

  test("解除组（unembed）保留子元素自由态", () => {
    const graph = makeGraph();
    const group = graph.addNode(elementToNodeMeta(groupElement(), shapeNameForKind("group")));
    const text = graph.addNode(elementToNodeMeta(textElement("text-1"), shapeNameForKind("text")));
    group.insertChild(text);
    group.unembed(text);
    expect(text.getParent()).toBeNull();
    expect(graph.getCellById("text-1")).toBeTruthy();
    graph.dispose();
  });
});

describe("文档 ↔ cell 回写（事件桥）", () => {
  test("位置 / 尺寸变更后重建文档回写最新几何", () => {
    const graph = makeGraph();
    const text = graph.addNode(elementToNodeMeta(textElement("text-1"), shapeNameForKind("text")));
    text.setPosition(120, 200);
    text.setSize(300, 80);

    const document = graphToDocument(graph);
    const doc = document.elements.find((e) => e.id === "text-1");
    expect(doc?.x).toBe(120);
    expect(doc?.y).toBe(200);
    expect(doc?.width).toBe(300);
    expect(doc?.height).toBe(80);
    graph.dispose();
  });

  test("事件桥：增删节点后文档元素数同步", () => {
    const graph = makeGraph();
    graph.addNode(elementToNodeMeta(textElement("text-1"), shapeNameForKind("text")));
    expect(graphToDocument(graph).elements).toHaveLength(1);
    graph.getCellById("text-1")?.remove();
    expect(graphToDocument(graph).elements).toHaveLength(0);
    graph.dispose();
  });
});

describe("fromJSON 往返加载", () => {
  test("group 元素经 fromJSON 重建后被渲染为 x6-node", () => {
    const graph = makeGraph();
    const doc: CanvasDocument = {
      elements: [groupElement() as unknown as import("./document").CanvasElementDTO],
      edges: [],
    };
    graph.fromJSON(documentToGraphData(doc, (element) => shapeNameForKind(element.kind)));
    expect(graph.getCellById("group-1")).toBeTruthy();
    expect(graph.getNodes()).toHaveLength(1);
    graph.dispose();
  });
});
