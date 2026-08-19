import { describe, expect, it } from "vitest";
import { MarkerType } from "@xyflow/react";
import { DEFAULT_CANVAS_EDGE_STYLE, type CanvasDocument, type CanvasElementDTO } from "./document";
import { toCanvasDocument, toFlowData } from "./graph-document";

function element(id: string, parentId: string | null = null): CanvasElementDTO {
  return {
    id,
    canvasId: "canvas",
    parentId,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    zIndex: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: { text: id },
  } as CanvasElementDTO;
}

describe("CanvasDocument ↔ React Flow mapping", () => {
  it("orders parent nodes before children and maps edge presentation", () => {
    const document: CanvasDocument = {
      elements: [element("child", "group"), element("group")],
      edges: [
        {
          id: "edge",
          canvasId: "canvas",
          sourceElementId: "group",
          targetElementId: "child",
          label: "derives",
          style: {
            ...DEFAULT_CANVAS_EDGE_STYLE,
            lineStyle: "dashed",
            arrowhead: "block",
          },
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const flow = toFlowData(document);

    expect(flow.nodes.map((node) => node.id)).toEqual(["group", "child"]);
    expect(flow.nodes.find((node) => node.id === "child")).toMatchObject({
      parentId: "group",
      extent: "parent",
      expandParent: true,
    });
    expect(flow.edges[0]).toMatchObject({
      type: "canvas",
      markerEnd: MarkerType.ArrowClosed,
      style: { strokeDasharray: "5 5" },
    });
  });

  it("round-trips dimensions and relative parent coordinates", () => {
    const document: CanvasDocument = {
      elements: [
        {
          ...element("group"),
          kind: "group",
          props: { label: "g" },
          width: 420,
          height: 300,
        },
        { ...element("child", "group"), x: 24, y: 48, width: 180, height: 96 },
      ],
      edges: [],
    } as CanvasDocument;
    const flow = toFlowData(document);
    const restored = toCanvasDocument(flow.nodes, flow.edges);
    expect(restored.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "group", width: 420, height: 300 }),
        expect.objectContaining({
          id: "child",
          parentId: "group",
          x: 24,
          y: 48,
          width: 180,
          height: 96,
        }),
      ]),
    );
  });
});
