import { describe, expect, test } from "vitest";
import { assertValidDocument, CanvasValidationError } from "./validate";
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
  partial: Omit<Partial<CanvasEdgeDTO>, "source" | "target"> & {
    id: string;
    sourceElementId: string;
    targetElementId: string;
  },
): CanvasEdgeDTO {
  const { sourceElementId, targetElementId, ...rest } = partial;
  return {
    canvasId: "canvas-1",
    source: { cell: sourceElementId, port: "right" },
    target: { cell: targetElementId, port: "left" },
    router: null,
    connector: { name: "smooth" },
    attrs: {},
    label: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...rest,
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
      element({ id: "e3", kind: "text", props: { text: "note" } }),
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

  test("self-loop edge is accepted", () => {
    const elements = [element({ id: "e1" })];
    const edges = [edge({ id: "x", sourceElementId: "e1", targetElementId: "e1" })];
    expect(() => assertValidDocument(doc(elements, edges))).not.toThrow();
  });

  test("parallel edges are accepted", () => {
    const elements = [element({ id: "e1" }), element({ id: "e2" })];
    const edges = [
      edge({ id: "x", sourceElementId: "e1", targetElementId: "e2" }),
      edge({ id: "y", sourceElementId: "e1", targetElementId: "e2" }),
    ];
    expect(() => assertValidDocument(doc(elements, edges))).not.toThrow();
  });

  test("unknown edge ports are rejected", () => {
    const elements = [element({ id: "e1" }), element({ id: "e2" })];
    const bad = edge({ id: "x", sourceElementId: "e1", targetElementId: "e2" });
    bad.source.port = "unknown" as never;
    expect(() => assertValidDocument(doc(elements, [bad]))).toThrow(/invalid port/);
  });

  test("unknown X6 router and connector names are rejected", () => {
    const elements = [element({ id: "a" }), element({ id: "b" })];
    const invalidRouter = edge({ id: "r", sourceElementId: "a", targetElementId: "b" });
    invalidRouter.router = { name: "unknown" } as never;
    expect(() => assertValidDocument(doc(elements, [invalidRouter]))).toThrow(/invalid router/);

    const invalidConnector = edge({ id: "c", sourceElementId: "a", targetElementId: "b" });
    invalidConnector.connector = { name: "unknown" } as never;
    expect(() => assertValidDocument(doc(elements, [invalidConnector]))).toThrow(
      /invalid connector/,
    );
  });

  test("registered canvas connector is accepted", () => {
    const elements = [element({ id: "a" }), element({ id: "b" })];
    const curve = edge({ id: "c", sourceElementId: "a", targetElementId: "b" });
    curve.connector = { name: "reflecta-curve" };
    curve.router = { name: "reflecta-curve" };
    expect(() => assertValidDocument(doc(elements, [curve]))).not.toThrow();
  });

  test("native manhattan canvas router is accepted", () => {
    const elements = [element({ id: "a" }), element({ id: "b" })];
    const orthogonal = edge({ id: "o", sourceElementId: "a", targetElementId: "b" });
    orthogonal.router = {
      name: "manhattan",
      args: { startDirections: ["right"], endDirections: ["left"], padding: 16 },
    };
    expect(() => assertValidDocument(doc(elements, [orthogonal]))).not.toThrow();
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
});
