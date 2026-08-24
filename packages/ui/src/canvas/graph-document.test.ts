import { describe, expect, test, vi } from "vitest";
import type { CanvasDocument, CanvasEdgeDTO, CanvasElementDTO } from "./document";
import {
  applyEdgePresentation,
  applyElementUpdate,
  edgeToEdge,
  graphToDocument,
  curveEdgePath,
  curvePathData,
  curveTerminalRoutePoints,
  orthogonalEdgePath,
  symmetricOrthogonalRoutePoints,
  toX6Cells,
} from "./graph-document";

const timestamp = "2026-08-19T00:00:00.000Z";

function element(
  id: string,
  kind: "text" | "group",
  position: { x: number; y: number },
  size: { width: number; height: number },
  parentId?: string,
): CanvasElementDTO {
  return {
    id,
    canvasId: "canvas",
    parentId: parentId ?? null,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    zIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    kind,
    understandingId: null,
    canvasRefId: null,
    props: kind === "group" ? { label: id } : { text: id },
  } as CanvasElementDTO;
}

describe("graph-document toX6Cells", () => {
  test("maps a root element to a node with absolute position, shape and data", () => {
    const document: CanvasDocument = {
      elements: [element("a", "text", { x: 100, y: 120 }, { width: 220, height: 120 })],
      edges: [],
    };
    const cells = toX6Cells(document);
    expect(cells[0]).toMatchObject({
      id: "a",
      shape: "text",
      x: 100,
      y: 120,
      width: 220,
      height: 120,
      zIndex: 0,
    });
    expect(cells[0]).toHaveProperty("data");
    expect(cells[0]).toHaveProperty("ports");
  });

  test("converts child relative coordinates to absolute and drops them from parent chain of the parent ref", () => {
    const document: CanvasDocument = {
      elements: [
        element("outer", "group", { x: 50, y: 50 }, { width: 500, height: 400 }),
        element("child", "text", { x: 30, y: 40 }, { width: 100, height: 80 }, "outer"),
      ],
      edges: [],
    };
    const cells = toX6Cells(document);
    const outer = cells.find((c) => c.id === "outer");
    const child = cells.find((c) => c.id === "child");
    expect(outer).toMatchObject({ x: 50, y: 50, parent: undefined });
    expect(child).toMatchObject({ x: 80, y: 90, parent: "outer" });
  });

  test("passes X6 edge attrs / routing / marker / label metadata through", () => {
    const document: CanvasDocument = {
      elements: [
        element("a", "text", { x: 0, y: 0 }, { width: 100, height: 80 }),
        element("b", "text", { x: 300, y: 0 }, { width: 100, height: 80 }),
      ],
      edges: [
        {
          id: "e1",
          canvasId: "canvas",
          source: { cell: "a", port: "bottom" },
          target: { cell: "b", port: "top" },
          router: null,
          connector: { name: "smooth" },
          attrs: {
            line: {
              stroke: "var(--chart-1)",
              strokeWidth: 3,
              strokeDasharray: "5 5",
              targetMarker: { name: "block" },
            },
          },
          label: "causal",
          createdAt: timestamp,
        },
      ],
    };
    const cells = toX6Cells(document);
    const edge = cells.find((c) => c.id === "e1");
    expect(edge).toMatchObject({
      shape: "edge",
      source: { cell: "a", port: "bottom" },
      target: { cell: "b", port: "top" },
      connector: { name: "smooth" },
    });
    expect(
      (edge as { attrs: Record<string, { stroke?: string; strokeDasharray?: string }> }).attrs.line
        ?.stroke,
    ).toContain("chart-1");
    expect(
      (edge as { attrs: Record<string, { strokeDasharray?: string }> }).attrs.line?.strokeDasharray,
    ).toBe("5 5");
    expect(edge).toHaveProperty("labels");
  });

  test("passes persisted X6 router and connector through without mapping", () => {
    const mk = (routing: Pick<CanvasEdgeDTO, "router" | "connector">) => {
      const document: CanvasDocument = {
        elements: [
          element("a", "text", { x: 0, y: 0 }, { width: 100, height: 80 }),
          element("b", "text", { x: 300, y: 0 }, { width: 100, height: 80 }),
        ],
        edges: [
          {
            id: "e",
            canvasId: "canvas",
            source: { cell: "a", port: "right" },
            target: { cell: "b", port: "left" },
            ...routing,
            attrs: {},
            label: null,
            createdAt: timestamp,
          },
        ],
      };
      return toX6Cells(document).find((c) => c.id === "e");
    };
    // X6 3.x 内建 connector 无 straight：直线用 normal connector（无 router 中间点）
    const straight = mk({ router: null, connector: { name: "normal" } }) as {
      connector?: { name?: string };
      router?: unknown;
    };
    expect(straight.connector?.name).toBe("normal");
    expect(straight.router).toBeUndefined();
    const orth = mk(orthogonalEdgePath()) as {
      connector?: { name?: string };
      router?: { name?: string };
    };
    expect(orth.connector?.name).toBe("rounded");
    expect(orth.router?.name).toBe("reflecta-orthogonal");
  });
});

describe("in-place cell updates", () => {
  test("gives curves straight terminal runs before their rounded bends", () => {
    expect(curveEdgePath()).toEqual({
      router: { name: "reflecta-curve" },
      connector: { name: "reflecta-curve" },
    });
    expect(curveTerminalRoutePoints({ x: 0, y: 0 }, { x: 100, y: 100 }, "right", "left")).toEqual([
      { x: 16, y: 0 },
      { x: 84, y: 100 },
    ]);
    expect(curvePathData({ x: 0, y: 0 }, { x: 100, y: 100 }, "right", "left")).toMatch(
      /^M 0 0 L 16 0 C .+ 84 100 L 100 100$/,
    );
  });

  test("keeps both terminal runs of orthogonal edges equally long", () => {
    const horizontal = symmetricOrthogonalRoutePoints(
      { x: 600, y: 180 },
      { x: 460, y: 620 },
      "left",
      "right",
    );
    expect(horizontal).toEqual([
      { x: 584, y: 180 },
      { x: 530, y: 180 },
      { x: 530, y: 620 },
      { x: 476, y: 620 },
    ]);
    expect(600 - horizontal[0]!.x).toBe(horizontal.at(-1)!.x - 460);

    const vertical = symmetricOrthogonalRoutePoints(
      { x: 320, y: 500 },
      { x: 700, y: 200 },
      "top",
      "bottom",
    );
    expect(vertical).toEqual([
      { x: 320, y: 484 },
      { x: 320, y: 350 },
      { x: 700, y: 350 },
      { x: 700, y: 216 },
    ]);
    expect(500 - vertical[0]!.y).toBe(vertical.at(-1)!.y - 200);
  });

  test("keeps orthogonal terminal segments aligned with both fixed ports", () => {
    const points = symmetricOrthogonalRoutePoints(
      { x: 400, y: 720 },
      { x: 960, y: 272 },
      "top",
      "left",
    );
    expect(points[0]).toEqual({ x: 400, y: 704 });
    expect(points.at(-1)).toEqual({ x: 944, y: 272 });
  });

  test("excludes X6's transient incomplete edge from document snapshots", () => {
    const incomplete = {
      getSourceCellId: () => "a",
      getSourcePortId: () => "right",
      getTargetCellId: () => null,
      getTargetPortId: () => null,
    };
    expect(
      graphToDocument({ getNodes: () => [], getEdges: () => [incomplete] } as never).edges,
    ).toEqual([]);
  });

  test("reads X6 terminal ports into the persisted edge", () => {
    const current: CanvasEdgeDTO = {
      id: "e",
      canvasId: "canvas",
      source: { cell: "a", port: "right" },
      target: { cell: "b", port: "left" },
      router: null,
      connector: { name: "smooth" },
      attrs: {},
      label: null,
      createdAt: timestamp,
    };
    expect(
      edgeToEdge({
        id: "e",
        getData: () => ({ edge: current }),
        getSourceCellId: () => "a",
        getSourcePortId: () => "bottom",
        getTargetCellId: () => "b",
        getTargetPortId: () => "top",
        getRouter: () => ({ name: "manhattan" }),
        getConnector: () => ({ name: "rounded" }),
        getAttrs: () => ({ line: { strokeWidth: 3 } }),
      } as never),
    ).toMatchObject({
      source: { cell: "a", port: "bottom" },
      target: { cell: "b", port: "top" },
      router: { name: "manhattan" },
      connector: { name: "rounded" },
    });
  });

  test("applyElementUpdate writes the element onto the existing node data", () => {
    const replaceData = vi.fn();
    const next = element("a", "text", { x: 0, y: 0 }, { width: 100, height: 80 });
    if (next.kind !== "text") throw new Error("expected text element");
    const painted: CanvasElementDTO = { ...next, props: { ...next.props, color: "chart-2" } };
    applyElementUpdate({ replaceData } as never, painted);
    expect(replaceData).toHaveBeenCalledWith({ element: painted });
  });

  test("applyEdgePresentation writes native attrs/routing/label and keeps terminals", () => {
    const current: CanvasEdgeDTO = {
      id: "e",
      canvasId: "canvas",
      source: { cell: "a", port: "right" },
      target: { cell: "b", port: "left" },
      router: null,
      connector: { name: "smooth" },
      attrs: {},
      label: "old",
      createdAt: timestamp,
    };
    const cell = {
      id: "e",
      getData: () => ({ edge: current }),
      replaceData: vi.fn(),
      setAttrs: vi.fn(),
      setConnector: vi.fn(),
      setRouter: vi.fn(),
      removeRouter: vi.fn(),
      setLabels: vi.fn(),
    };
    applyEdgePresentation(cell as never, {
      attrs: { line: { stroke: "var(--chart-1)" } },
      router: null,
      connector: { name: "normal" },
      label: "new",
    });
    expect(cell.replaceData).toHaveBeenCalledWith({
      edge: {
        ...current,
        attrs: { line: { stroke: "var(--chart-1)" } },
        router: null,
        connector: { name: "normal" },
        label: "new",
      },
    });
    expect(cell.setConnector).toHaveBeenCalledWith({ name: "normal" });
    expect(cell.removeRouter).toHaveBeenCalled();
    expect(cell.setLabels).toHaveBeenCalledWith([
      {
        attrs: {
          body: { fill: "var(--background)", stroke: "none" },
          label: { text: "new", fill: "var(--chart-1)", fontSize: 12 },
        },
      },
    ]);
  });
});
