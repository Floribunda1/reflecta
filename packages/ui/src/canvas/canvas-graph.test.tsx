// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CanvasDocument, CanvasElementDTO } from "./document";
import { CanvasGraph, type CanvasGraphHandle, type CanvasGraphProps } from "./CanvasGraph";
import { setDndElement } from "./dnd";

const mocks = vi.hoisted(() => ({
  reactFlowProps: null as Record<string, unknown> | null,
  setViewport: vi.fn(),
  fitView: vi.fn(),
  screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x: x - 10, y: y - 20 })),
  getNode: vi.fn(),
  getEdge: vi.fn(),
  setEdges: vi.fn(),
  toPng: vi.fn(
    async (
      _node: HTMLElement,
      _options: {
        width: number;
        height: number;
        style: { transform: string };
        filter: (node: HTMLElement) => boolean;
      },
    ) => "data:image/png;base64,canvas",
  ),
  getNodesBounds: vi.fn(() => ({ x: -1000, y: -800, width: 2200, height: 1800 })),
  getViewportForBounds: vi.fn(() => ({ x: 12, y: 34, zoom: 0.5 })),
}));

vi.mock("html-to-image", () => ({ toPng: mocks.toPng }));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  const React = await import("react");
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ReactFlow: (props: Record<string, unknown>) => {
      mocks.reactFlowProps = props;
      return <div className="react-flow__viewport">{props.children as React.ReactNode}</div>;
    },
    Background: () => <div className="react-flow__background" />,
    MiniMap: () => <div data-testid="minimap" />,
    useNodesState: <T,>(initial: T[]) => {
      const [value, setValue] = React.useState(initial);
      return [value, setValue, vi.fn()] as const;
    },
    useEdgesState: <T,>(initial: T[]) => {
      const [value, setValue] = React.useState(initial);
      return [value, setValue, vi.fn()] as const;
    },
    useReactFlow: () => ({
      setViewport: mocks.setViewport,
      fitView: mocks.fitView,
      screenToFlowPosition: mocks.screenToFlowPosition,
      getZoom: vi.fn(() => 1),
      flowToScreenPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
      getNode: mocks.getNode,
      getEdge: mocks.getEdge,
      setEdges: mocks.setEdges,
    }),
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    getNodesBounds: mocks.getNodesBounds,
    getViewportForBounds: mocks.getViewportForBounds,
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const time = "2026-08-19T00:00:00.000Z";
function textElement(id: string, text = id): CanvasElementDTO {
  return {
    id,
    canvasId: "canvas",
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    parentId: null,
    x: 100,
    y: 120,
    width: 200,
    height: 100,
    zIndex: 0,
    props: { text },
    createdAt: time,
    updatedAt: time,
  };
}
function canvasDocument(ids = ["node"]): CanvasDocument {
  return { elements: ids.map((id) => textElement(id)), edges: [] };
}

let container: HTMLDivElement;
let root: Root;
let ref: ReturnType<typeof createRef<CanvasGraphHandle | null>>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reactFlowProps = null;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  ref = createRef<CanvasGraphHandle>();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(props: CanvasGraphProps = {}) {
  act(() => root.render(<CanvasGraph ref={ref} {...props} />));
  return mocks.reactFlowProps!;
}

describe("CanvasGraph React Flow seam", () => {
  test("emits complete node, edge, mixed, and empty selections without writing the document", () => {
    const onSelectionChange = vi.fn();
    const onDocumentChange = vi.fn();
    const flow = render({ onSelectionChange, onDocumentChange });
    const select = flow.onSelectionChange as (selection: {
      nodes: Array<{ id: string }>;
      edges: Array<{ id: string }>;
    }) => void;
    act(() => select({ nodes: [{ id: "node" }], edges: [] }));
    act(() => select({ nodes: [], edges: [{ id: "edge" }] }));
    act(() => select({ nodes: [{ id: "node" }], edges: [{ id: "edge" }] }));
    act(() => select({ nodes: [], edges: [] }));
    expect(onSelectionChange.mock.calls.map(([ids]) => ids)).toEqual([
      ["node"],
      ["edge"],
      ["node", "edge"],
      [],
    ]);
    expect(onDocumentChange).not.toHaveBeenCalled();
  });

  test("viewport changes emit only the viewport callback", () => {
    const onViewportChange = vi.fn();
    const onDocumentChange = vi.fn();
    const flow = render({ onViewportChange, onDocumentChange });
    act(() => (flow.onViewportChange as (value: unknown) => void)({ x: 10, y: 20, zoom: 1.5 }));
    expect(onViewportChange).toHaveBeenCalledWith({ x: 10, y: 20, zoom: 1.5 });
    expect(onDocumentChange).not.toHaveBeenCalled();
  });

  test("readonly blocks every business write and selection callback", () => {
    const onDocumentChange = vi.fn();
    const onViewportChange = vi.fn();
    const onSelectionChange = vi.fn();
    const flow = render({
      readonly: true,
      document: canvasDocument(),
      onDocumentChange,
      onViewportChange,
      onSelectionChange,
    });
    act(() =>
      (flow.onNodesChange as (changes: unknown[]) => void)([
        { id: "node", type: "position", position: { x: 200, y: 200 } },
      ]),
    );
    act(() => (flow.onEdgesChange as (changes: unknown[]) => void)([]));
    act(() =>
      (flow.onConnect as (connection: unknown) => void)({
        source: "node",
        target: "node",
        sourceHandle: null,
        targetHandle: null,
      }),
    );
    act(() => (flow.onViewportChange as (viewport: unknown) => void)({ x: 1, y: 2, zoom: 2 }));
    act(() =>
      (flow.onSelectionChange as (selection: unknown) => void)({
        nodes: [{ id: "node" }],
        edges: [],
      }),
    );
    expect(onDocumentChange).not.toHaveBeenCalled();
    expect(onViewportChange).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(flow).toMatchObject({
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
      deleteKeyCode: null,
    });
    expect(container.querySelector('[data-testid="minimap"]')).toBeNull();
  });

  test("external document and imperative reload replace graph state without saving", () => {
    const onDocumentChange = vi.fn();
    render({ document: canvasDocument(["first"]), onDocumentChange });
    render({ document: canvasDocument(["external"]), onDocumentChange });
    expect((mocks.reactFlowProps!.nodes as Array<{ id: string }>).map((node) => node.id)).toEqual([
      "external",
    ]);
    act(() => ref.current?.reload(canvasDocument(["reloaded"])));
    expect((mocks.reactFlowProps!.nodes as Array<{ id: string }>).map((node) => node.id)).toEqual([
      "reloaded",
    ]);
    expect(onDocumentChange).not.toHaveBeenCalled();
  });

  test("imperative add and update each write one complete document", () => {
    const onDocumentChange = vi.fn();
    const document: CanvasDocument = {
      elements: [textElement("source")],
      edges: [
        {
          id: "edge",
          canvasId: "canvas",
          sourceElementId: "source",
          targetElementId: "source",
          label: null,
          style: null,
          createdAt: time,
        },
      ],
    };
    render({ document, onDocumentChange });
    act(() => ref.current?.addElement(textElement("added")));
    expect(onDocumentChange).toHaveBeenCalledTimes(1);
    expect(
      onDocumentChange.mock.calls[0][0].elements.map((element: CanvasElementDTO) => element.id),
    ).toEqual(["source", "added"]);
    act(() => ref.current?.updateEdge({ ...document.edges[0], label: "UPDATED" }));
    expect(onDocumentChange).toHaveBeenCalledTimes(2);
    expect(onDocumentChange.mock.calls[1][0].edges[0].label).toBe("UPDATED");
  });

  test("waits for viewport readiness, then restores saved viewport or fits unsaved content", () => {
    render({ viewportReady: false, viewport: { x: 1, y: 2, zoom: 1.25 } });
    expect(mocks.setViewport).not.toHaveBeenCalled();
    expect(mocks.fitView).not.toHaveBeenCalled();
    render({ viewportReady: true, viewport: { x: 1, y: 2, zoom: 1.25 } });
    expect(mocks.setViewport).toHaveBeenCalledWith({ x: 1, y: 2, zoom: 1.25 });
    mocks.fitView.mockClear();
    render({ viewportReady: true, viewport: null });
    expect(mocks.fitView).toHaveBeenCalledWith({ padding: 0.2, maxZoom: 1 });
  });

  test("pins every intentional React Flow input configuration", () => {
    const flow = render();
    expect(flow).toMatchObject({
      selectionOnDrag: true,
      selectionMode: "partial",
      panOnDrag: [1], // 仅中键平移：左键拖拽留给框选（selectionOnDrag），滚轮给 panOnScroll
      panOnScroll: true,
      snapToGrid: true,
      snapGrid: [10, 10],
      deleteKeyCode: "Backspace",
      onlyRenderVisibleElements: true,
    });
  });

  test("retokenizes the official group shell and paints color onto the wrapper", () => {
    const group: CanvasElementDTO = {
      ...textElement("group"),
      kind: "group",
      understandingId: null,
      canvasRefId: null,
      props: { label: "GROUP", color: "chart-1" },
    };
    const graph = render({
      document: {
        elements: [group],
        edges: [],
      },
    });
    const className = container.querySelector('[data-testid="canvas-graph"]')?.className ?? "";
    expect(className).toContain("[--xy-node-border:1px_solid_var(--border)]");
    expect(className).toContain("[--xy-node-group-background-color:");
    const node = (graph.nodes as Array<{ id: string; style?: { borderColor?: string } }>)[0];
    expect(node.style?.borderColor).toBe("var(--chart-1)");
  });

  test("raises the edge label renderer above canvas nodes", () => {
    render({ document: { elements: [], edges: [] } });
    expect(container.querySelector('[data-testid="canvas-graph"]')?.className).toContain(
      "[&_.react-flow__edgelabel-renderer]:!z-[1002]",
    );
  });

  test("selection toolbar appears for two or more selected nodes and groups them", () => {
    const onDocumentChange = vi.fn();
    const flow = render({ document: canvasDocument(["a", "b"]), onDocumentChange });
    const select = flow.onSelectionChange as (selection: {
      nodes: Array<{ id: string }>;
      edges: Array<{ id: string }>;
    }) => void;

    // 单节点选中：不显示工具条
    act(() => select({ nodes: [{ id: "a" }], edges: [] }));
    expect(container.querySelector('[data-testid="canvas-selection-toolbar"]')).toBeNull();

    // 两个节点选中：工具条出现
    act(() => select({ nodes: [{ id: "a" }, { id: "b" }], edges: [] }));
    const toolbar = container.querySelector('[data-testid="canvas-selection-toolbar"]');
    expect(toolbar).not.toBeNull();

    // 点击打组：文档新增 group 元素，成员改挂 parentId
    act(() => {
      toolbar!
        .querySelector('[data-testid="canvas-selection-group-button"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDocumentChange).toHaveBeenCalledTimes(1);
    const elements = onDocumentChange.mock.calls[0][0].elements as CanvasElementDTO[];
    expect(elements.find((element) => element.kind === "group")).toBeTruthy();
    expect(elements.find((element) => element.id === "a")!.parentId).toBeTruthy();
    expect(elements.find((element) => element.id === "b")!.parentId).toBeTruthy();
  });

  test("readonly never shows the selection toolbar", () => {
    const flow = render({ readonly: true, document: canvasDocument(["a", "b"]) });
    const select = flow.onSelectionChange as (selection: {
      nodes: Array<{ id: string }>;
      edges: Array<{ id: string }>;
    }) => void;
    act(() => select({ nodes: [{ id: "a" }, { id: "b" }], edges: [] }));
    expect(container.querySelector('[data-testid="canvas-selection-toolbar"]')).toBeNull();
  });

  test("drop preview follows the cursor while dragging and clears on leave/drop", () => {
    const flow = render({});
    const valid = JSON.stringify(textElement("dragged"));
    const MIME = "application/reflecta-canvas-element";
    const dragOver = flow.onDragOver as (event: unknown) => void;
    const dragLeave = flow.onDragLeave as (event: unknown) => void;
    const dragData = { types: [MIME], getData: () => valid };
    // 占位框常驻，显隐用 opacity 控制（避免首次 dragover 在左上角闪一下）。
    const preview = () =>
      container.querySelector<HTMLElement>('[data-testid="canvas-drop-preview"]');
    // happy-dom 下容器无真实布局，注入坐标系以验证预览跟随 / 离开判断。
    const graph = container.querySelector<HTMLElement>('[data-testid="canvas-graph"]')!;
    graph.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 300,
        width: 400,
        height: 300,
        x: 0,
        y: 0,
      }) as DOMRect;
    // 初始隐藏（占位框常驻，靠 opacity-0 类 + inline opacity 控制）
    expect(preview()).not.toBeNull();
    expect(preview()!.className).toContain("opacity-0");

    // getData 在 dragover 阶段读不到，预览要素来自源 dragstart 写入的暂存。
    setDndElement(textElement("dragged"));
    try {
      // 首次 dragover：直接显隐 + 定位（本次即拿到位置，不再有 (0,0) 闪帧）。
      act(() =>
        dragOver({ preventDefault: vi.fn(), clientX: 110, clientY: 220, dataTransfer: dragData }),
      );
      expect(preview()!.style.opacity).toBe("1");
      expect(preview()!.style.width).toBe("200px");
      expect(preview()!.style.height).toBe("100px");
      expect(preview()!.style.transform).toBe("translate(110px, 220px)");

      // 后续 dragover：继续跟随。
      act(() =>
        dragOver({ preventDefault: vi.fn(), clientX: 130, clientY: 240, dataTransfer: dragData }),
      );
      expect(preview()!.style.transform).toBe("translate(130px, 240px)");

      // 真正离开容器（坐标越界）隐藏；仍在容器内（移到后代）保持显示。
      act(() => dragLeave({ clientX: 5, clientY: 5, dataTransfer: dragData }));
      expect(preview()!.style.opacity).toBe("1");
      act(() => dragLeave({ clientX: -50, clientY: -50, dataTransfer: dragData }));
      expect(preview()!.style.opacity).toBe("0");

      // 再次进入重新显示；drop 后隐藏（drop 阶段 getData 可读 → 节点落位）。
      act(() =>
        dragOver({ preventDefault: vi.fn(), clientX: 110, clientY: 220, dataTransfer: dragData }),
      );
      expect(preview()!.style.opacity).toBe("1");
      act(() =>
        (flow.onDrop as (event: unknown) => void)({
          preventDefault: vi.fn(),
          clientX: 110,
          clientY: 220,
          dataTransfer: dragData,
        }),
      );
      expect(preview()!.style.opacity).toBe("0");
    } finally {
      setDndElement(null);
    }
  });

  test("external drop uses screen coordinates once and ignores malformed or readonly payloads", () => {
    const onDocumentChange = vi.fn();
    const flow = render({ onDocumentChange });
    const drop = flow.onDrop as (event: unknown) => void;
    const valid = JSON.stringify(textElement("dropped"));
    act(() =>
      drop({
        preventDefault: vi.fn(),
        clientX: 110,
        clientY: 220,
        dataTransfer: { getData: () => valid },
      }),
    );
    expect(mocks.screenToFlowPosition).toHaveBeenCalledWith({ x: 110, y: 220 });
    expect(onDocumentChange.mock.calls[0][0].elements[0]).toMatchObject({
      id: "dropped",
      x: 100,
      y: 200,
    });
    act(() =>
      drop({
        preventDefault: vi.fn(),
        clientX: 0,
        clientY: 0,
        dataTransfer: { getData: () => "{" },
      }),
    );
    expect(onDocumentChange).toHaveBeenCalledTimes(1);
    const readonlyFlow = render({ readonly: true, onDocumentChange });
    act(() =>
      (readonlyFlow.onDrop as (event: unknown) => void)({
        preventDefault: vi.fn(),
        dataTransfer: { getData: () => valid },
      }),
    );
    expect(onDocumentChange).toHaveBeenCalledTimes(1);
  });

  test("PNG export handles empty and offscreen content without changing the live viewport", async () => {
    render({ document: { elements: [], edges: [] } });
    await act(async () => ref.current?.exportPng());
    expect(mocks.toPng).not.toHaveBeenCalled();

    render({ document: canvasDocument(["offscreen"]) });
    const graph = container.querySelector<HTMLElement>('[data-testid="canvas-graph"]')!;
    Object.defineProperties(graph, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await act(async () => ref.current?.exportPng());
    expect(mocks.getNodesBounds).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "offscreen" })]),
    );
    const options = mocks.toPng.mock.calls[0][1];
    expect(options).toMatchObject({
      width: 800,
      height: 600,
      style: { transform: "translate(12px, 34px) scale(0.5)" },
    });
    const background = document.createElement("div");
    background.className = "react-flow__background";
    expect(options.filter(background)).toBe(false);
    expect(click).toHaveBeenCalledOnce();
    expect(mocks.setViewport).not.toHaveBeenCalled();
    click.mockRestore();
  });
});
