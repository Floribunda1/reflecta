import { describe, expect, test } from "vitest";
import { assertValidDocument, assertValidEdgeStyle, CanvasValidationError } from "./validate";
import type { CanvasDocument, CanvasElementDTO, CanvasEdgeDTO } from "./types";

function element(partial: Partial<CanvasElementDTO> & { id: string }): CanvasElementDTO {
  const base = {
    canvasId: "canvas-1",
    parentId: null,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    zIndex: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  const kind = partial.kind ?? "text";
  switch (kind) {
    case "understanding":
      return {
        ...base,
        kind,
        understandingId: "u-1",
        canvasRefId: null,
        props: {},
        ...partial,
      } as CanvasElementDTO;
    case "text":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { text: "" },
        ...partial,
      } as CanvasElementDTO;
    case "shape":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { shapeType: "rect" },
        ...partial,
      } as CanvasElementDTO;
    case "group":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { label: "" },
        ...partial,
      } as CanvasElementDTO;
    case "canvas_ref":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: "canvas-2",
        props: {},
        ...partial,
      } as CanvasElementDTO;
  }
}

function edge(
  partial: Partial<CanvasEdgeDTO> & {
    id: string;
    sourceElementId: string;
    targetElementId: string;
  },
): CanvasEdgeDTO {
  return {
    canvasId: "canvas-1",
    label: null,
    style: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

function doc(elements: CanvasElementDTO[], edges: CanvasEdgeDTO[] = []): CanvasDocument {
  return { elements, edges };
}

describe("Canvas document validation", () => {
  test("accepts a valid document with all element kinds and edges", () => {
    const elements = [
      element({ id: "e1", kind: "understanding" }),
      element({ id: "e2", kind: "text", props: { text: "note" } }),
      element({ id: "e3", kind: "shape", props: { shapeType: "circle" } }),
      element({ id: "e4", kind: "group", props: { label: "core" } }),
      element({ id: "e5", kind: "canvas_ref" }),
    ];
    const edges = [
      edge({ id: "edge-1", sourceElementId: "e1", targetElementId: "e2", label: "依赖" }),
    ];
    expect(() => assertValidDocument(doc(elements, edges))).not.toThrow();
  });

  test("empty document is valid (clearing a canvas is legal)", () => {
    expect(() => assertValidDocument(doc([]))).not.toThrow();
  });

  test.each([
    ["duplicate element ids", () => doc([element({ id: "e1" }), element({ id: "e1" })])],
    [
      "duplicate edge ids",
      () =>
        doc(
          [element({ id: "e1" }), element({ id: "e2" })],
          [
            edge({ id: "x", sourceElementId: "e1", targetElementId: "e2" }),
            edge({ id: "x", sourceElementId: "e2", targetElementId: "e1" }),
          ],
        ),
    ],
  ] as const)("rejects %s", (_label, make) => {
    expect(() => assertValidDocument(make())).toThrow(CanvasValidationError);
  });

  test("understanding element without understandingId is rejected", () => {
    const bad = element({ id: "e1", kind: "understanding", understandingId: null });
    expect(() => assertValidDocument(doc([bad]))).toThrow(/must have understandingId/);
  });

  test("shape element without valid shapeType is rejected", () => {
    const bad = element({ id: "e1", kind: "shape", props: { shapeType: "triangle" as never } });
    expect(() => assertValidDocument(doc([bad]))).toThrow(/shapeType/);
  });

  test("canvas_ref element without canvasRefId is rejected", () => {
    const bad = element({ id: "e1", kind: "canvas_ref", canvasRefId: null });
    expect(() => assertValidDocument(doc([bad]))).toThrow(/must have canvasRefId/);
  });

  test("group element without label is rejected", () => {
    const bad = element({ id: "e1", kind: "group", props: { label: 42 as never } });
    expect(() => assertValidDocument(doc([bad]))).toThrow(/label/);
  });

  test("edge to an element outside the document is rejected", () => {
    const elements = [element({ id: "e1" })];
    const edges = [edge({ id: "x", sourceElementId: "e1", targetElementId: "missing" })];
    expect(() => assertValidDocument(doc(elements, edges))).toThrow(
      /target element not in document/,
    );
  });

  test("self-loop edge is rejected", () => {
    const elements = [element({ id: "e1" })];
    const edges = [edge({ id: "x", sourceElementId: "e1", targetElementId: "e1" })];
    expect(() => assertValidDocument(doc(elements, edges))).toThrow(/self-loop/);
  });

  test("parent must be a group", () => {
    const elements = [
      element({ id: "group", kind: "group" }),
      element({ id: "child", parentId: "group" }),
      element({ id: "bad-parent", kind: "text" }),
      element({ id: "child-of-text", parentId: "bad-parent" }),
    ];
    expect(() => assertValidDocument(doc(elements))).toThrow(/parent is not a group/);
  });

  test("parent cycle is rejected", () => {
    const elements = [
      element({ id: "a", kind: "group", parentId: "b" }),
      element({ id: "b", kind: "group", parentId: "a" }),
    ];
    expect(() => assertValidDocument(doc(elements))).toThrow(/cycle|parent/);
  });

  test("deep ancestor chain is rejected when it reaches the element", () => {
    const elements = [
      element({ id: "a", kind: "group", parentId: "b" }),
      element({ id: "b", kind: "group", parentId: "c" }),
      element({ id: "c", kind: "group", parentId: "a" }),
    ];
    expect(() => assertValidDocument(doc(elements))).toThrow(CanvasValidationError);
  });

  test("valid edge style passes; invalid enum is rejected", () => {
    expect(() =>
      assertValidEdgeStyle({
        routing: "orthogonal",
        lineStyle: "dashed",
        width: "thick",
        arrowhead: "block",
        color: "#ff0000",
      }),
    ).not.toThrow();
    expect(() => assertValidEdgeStyle({ routing: "diagonal" })).toThrow(/routing invalid/);
    expect(() => assertValidEdgeStyle({ lineStyle: "wavy" })).toThrow(/lineStyle invalid/);
    expect(() => assertValidEdgeStyle("solid")).toThrow(/must be an object/);
    expect(() => assertValidEdgeStyle(null)).not.toThrow();
    expect(() => assertValidEdgeStyle(undefined)).not.toThrow();
  });
});
