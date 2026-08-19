import { describe, expect, test } from "vitest";
import { MarkerType } from "@xyflow/react";
import type { CanvasDocument, CanvasElementDTO } from "./document";
import { toCanvasDocument, toFlowData, toFlowEdge } from "./graph-document";

const timestamp = "2026-08-19T00:00:00.000Z";

function element(
  id: string,
  kind: CanvasElementDTO["kind"] = "text",
  parentId: string | null = null,
): CanvasElementDTO {
  const base = {
    id,
    canvasId: "canvas",
    parentId,
    x: 20,
    y: 40,
    width: 180,
    height: 96,
    zIndex: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (kind === "understanding")
    return {
      ...base,
      kind,
      understandingId: "understanding",
      canvasRefId: null,
      props: {},
    };
  if (kind === "group")
    return {
      ...base,
      kind,
      understandingId: null,
      canvasRefId: null,
      props: { label: "Group" },
    };
  if (kind === "canvas_ref")
    return {
      ...base,
      kind,
      understandingId: null,
      canvasRefId: "referenced-canvas",
      props: {},
    };
  return {
    ...base,
    kind,
    understandingId: null,
    canvasRefId: null,
    props: { text: "Markdown" },
  };
}

describe("CanvasDocument React Flow adapter", () => {
  test("round-trips every element kind and edge without losing document fields", () => {
    const document: CanvasDocument = {
      elements: [
        element("understanding", "understanding"),
        element("text"),
        element("group", "group"),
        element("canvas-ref", "canvas_ref"),
      ],
      edges: [
        {
          id: "edge",
          canvasId: "canvas",
          sourceElementId: "understanding",
          targetElementId: "text",
          label: "supports",
          style: {
            routing: "orthogonal",
            lineStyle: "dashed",
            color: "#2563eb",
            width: "thick",
            arrowhead: "block",
          },
          createdAt: timestamp,
        },
      ],
    };

    const flow = toFlowData(document);
    const restored = toCanvasDocument(flow.nodes, flow.edges);

    expect(restored).toEqual(document);
  });

  test("orders every parent before its descendants", () => {
    const document: CanvasDocument = {
      elements: [
        { ...element("leaf"), parentId: "inner" },
        { ...element("inner", "group"), parentId: "outer" },
        element("outer", "group"),
      ],
      edges: [],
    };

    expect(toFlowData(document).nodes.map((node) => node.id)).toEqual(["outer", "inner", "leaf"]);
  });

  test("round-trips nested relative coordinates", () => {
    const document: CanvasDocument = {
      elements: [
        { ...element("outer", "group"), x: 80, y: 60 },
        { ...element("inner", "group", "outer"), x: 30, y: 40 },
        { ...element("leaf", "text", "inner"), x: 12, y: 24 },
      ],
      edges: [],
    };

    const flow = toFlowData(document);
    expect(toCanvasDocument(flow.nodes, flow.edges)).toEqual(document);
  });

  test("writes measured geometry without leaking React Flow interaction state", () => {
    const node = toFlowData({ elements: [element("text")], edges: [] }).nodes[0];
    const restored = toCanvasDocument(
      [
        {
          ...node,
          selected: true,
          dragging: true,
          measured: { width: 320, height: 160 },
        },
      ],
      [],
    ).elements[0];

    expect(restored).toEqual({ ...element("text"), width: 320, height: 160 });
    expect(restored).not.toHaveProperty("selected");
    expect(restored).not.toHaveProperty("dragging");
    expect(restored).not.toHaveProperty("measured");
  });

  test("maps the persisted stacking order into React Flow", () => {
    expect(toFlowData({ elements: [element("text")], edges: [] }).nodes[0].zIndex).toBe(3);
  });

  test("preserves parallel edges and self loops", () => {
    const edge = {
      id: "edge-1",
      canvasId: "canvas",
      sourceElementId: "text",
      targetElementId: "text",
      label: null,
      style: null,
      createdAt: timestamp,
    };
    const document: CanvasDocument = {
      elements: [element("text")],
      edges: [edge, { ...edge, id: "edge-2", label: "another relation" }],
    };

    const flow = toFlowData(document);
    expect(toCanvasDocument(flow.nodes, flow.edges)).toEqual(document);
  });

  test.each([
    ["solid", undefined],
    ["dashed", "5 5"],
    ["dotted", "2 2"],
  ] as const)("maps %s edge strokes", (lineStyle, strokeDasharray) => {
    const flow = toFlowEdge({
      id: "edge",
      canvasId: "canvas",
      sourceElementId: "source",
      targetElementId: "target",
      label: null,
      style: { lineStyle },
      createdAt: timestamp,
    });
    expect(flow.style).toMatchObject({ strokeDasharray });
  });

  test.each([
    ["thin", 2],
    ["medium", 3],
    ["thick", 4],
  ] as const)("maps %s edge widths", (width, strokeWidth) => {
    expect(
      toFlowEdge({
        id: "edge",
        canvasId: "canvas",
        sourceElementId: "source",
        targetElementId: "target",
        label: null,
        style: { width },
        createdAt: timestamp,
      }).style,
    ).toMatchObject({ strokeWidth });
  });

  test.each([
    ["arrow", MarkerType.Arrow],
    ["block", MarkerType.ArrowClosed],
    ["none", undefined],
  ] as const)("maps %s arrowheads", (arrowhead, markerEnd) => {
    expect(
      toFlowEdge({
        id: "edge",
        canvasId: "canvas",
        sourceElementId: "source",
        targetElementId: "target",
        label: null,
        style: { arrowhead },
        createdAt: timestamp,
      }).markerEnd,
    ).toBe(markerEnd);
  });

  test("maps custom edge color independently", () => {
    expect(
      toFlowEdge({
        id: "edge",
        canvasId: "canvas",
        sourceElementId: "source",
        targetElementId: "target",
        label: null,
        style: { color: "#123456" },
        createdAt: timestamp,
      }).style,
    ).toMatchObject({ stroke: "#123456" });
    expect(
      toFlowEdge({
        id: "edge",
        canvasId: "canvas",
        sourceElementId: "source",
        targetElementId: "target",
        label: null,
        style: { color: "chart-1" },
        createdAt: timestamp,
      }).style,
    ).toMatchObject({ stroke: "var(--chart-1)" });
  });
});
