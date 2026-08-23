import { describe, expect, test, vi } from "vitest";
import type { CanvasDocument, CanvasEdgeDTO, CanvasElementDTO } from "./document";
import {
  applyEdgePresentation,
  applyElementUpdate,
  edgeRoutingFor,
  edgeToEdge,
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
  test("uses native adaptive curves and port-aware manhattan routing", () => {
    expect(edgeRoutingFor({ routing: "curve" }, "out", "in")).toEqual({
      connector: { name: "smooth" },
    });
    expect(edgeRoutingFor({ routing: "orthogonal" }, "out-bottom", "in-top")).toEqual({
      router: {
        name: "manhattan",
        args: {
          padding: 20,
          startDirections: ["bottom"],
          endDirections: ["top"],
        },
      },
      connector: { name: "rounded", args: { radius: 8 } },
    });
  });

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

  test("maps an edge with routing / style / marker / label metadata", () => {
    const document: CanvasDocument = {
      elements: [
        element("a", "text", { x: 0, y: 0 }, { width: 100, height: 80 }),
        element("b", "text", { x: 300, y: 0 }, { width: 100, height: 80 }),
      ],
      edges: [
        {
          id: "e1",
          canvasId: "canvas",
          source: { cell: "a", port: "out-bottom" },
          target: { cell: "b", port: "in-top" },
          label: "causal",
          style: {
            routing: "curve",
            lineStyle: "dashed",
            width: "medium",
            color: "chart-1",
            arrowhead: "block",
          },
          createdAt: timestamp,
        },
      ],
    };
    const cells = toX6Cells(document);
    const edge = cells.find((c) => c.id === "e1");
    expect(edge).toMatchObject({
      shape: "edge",
      source: { cell: "a", port: "out-bottom" },
      target: { cell: "b", port: "in-top" },
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

  test("straight / orthogonal routing map to their connectors", () => {
    const mk = (routing: "straight" | "orthogonal") => {
      const document: CanvasDocument = {
        elements: [
          element("a", "text", { x: 0, y: 0 }, { width: 100, height: 80 }),
          element("b", "text", { x: 300, y: 0 }, { width: 100, height: 80 }),
        ],
        edges: [
          {
            id: "e",
            canvasId: "canvas",
            source: { cell: "a", port: "out" },
            target: { cell: "b", port: "in" },
            label: null,
            style: { routing },
            createdAt: timestamp,
          },
        ],
      };
      return toX6Cells(document).find((c) => c.id === "e");
    };
    // X6 3.x 内建 connector 无 straight：直线用 normal connector（无 router 中间点）
    const straight = mk("straight") as { connector?: { name?: string }; router?: unknown };
    expect(straight.connector?.name).toBe("normal");
    expect(straight.router).toBeUndefined();
    const orth = mk("orthogonal") as { connector?: { name?: string }; router?: { name?: string } };
    expect(orth.connector?.name).toBe("rounded");
    expect(orth.router?.name).toBe("manhattan");
  });
});

describe("in-place cell updates", () => {
  test("reads X6 terminal ports into the persisted edge", () => {
    const current: CanvasEdgeDTO = {
      id: "e",
      canvasId: "canvas",
      source: { cell: "a", port: "out" },
      target: { cell: "b", port: "in" },
      label: null,
      style: null,
      createdAt: timestamp,
    };
    expect(
      edgeToEdge({
        id: "e",
        getData: () => ({ edge: current }),
        getSourceCellId: () => "a",
        getSourcePortId: () => "out-bottom",
        getTargetCellId: () => "b",
        getTargetPortId: () => "in-top",
      } as never),
    ).toMatchObject({
      source: { cell: "a", port: "out-bottom" },
      target: { cell: "b", port: "in-top" },
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

  test("applyEdgePresentation merges style/label and keeps source/target from current data", () => {
    const current: CanvasEdgeDTO = {
      id: "e",
      canvasId: "canvas",
      source: { cell: "a", port: "out" },
      target: { cell: "b", port: "in" },
      label: "old",
      style: { routing: "curve" },
      createdAt: timestamp,
    };
    const cell = {
      id: "e",
      getData: () => ({ edge: current }),
      getSourcePortId: () => "out",
      getTargetPortId: () => "in",
      replaceData: vi.fn(),
      setAttrs: vi.fn(),
      setConnector: vi.fn(),
      setRouter: vi.fn(),
      removeRouter: vi.fn(),
      setLabels: vi.fn(),
    };
    applyEdgePresentation(cell as never, {
      style: { routing: "straight", color: "chart-1" },
      label: "new",
    });
    expect(cell.replaceData).toHaveBeenCalledWith({
      edge: {
        ...current,
        style: { routing: "straight", color: "chart-1" },
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
