import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import {
  Clipboard,
  Dnd,
  Export,
  Graph,
  History,
  Keyboard,
  MiniMap,
  Selection,
  Snapline,
  Transform,
} from "@antv/x6";
import { getProvider as ReactShapePortal } from "@antv/x6-react-shape";
import { useLatest } from "ahooks";
import { Group, Trash2 } from "lucide-react";
import { Button } from "../components/button";
import { cn } from "../lib/utils";
import { ensureCanvasShapes } from "./nodes";
import type { CanvasCellAction } from "./shape-context";
import type { CanvasDocument, CanvasEdgeDTO, CanvasElementDTO, CanvasViewport } from "./document";
import {
  toX6Cells,
  graphToDocument,
  newEdgeDto,
  toX6Edge,
  nodeMetadataFor,
} from "./graph-document";
import { deleteElements, groupElements, ungroupGroups } from "./graph-operations";
import { EdgeOverlay } from "./EdgeOverlay";
import {
  CanvasEdgeUpdateProvider,
  CanvasElementUpdateProvider,
  CanvasShapeDataProvider,
  EMPTY_CANVAS_SHAPE_DATA,
  type CanvasShapeData,
} from "./shape-context";

/**
 * X6 画布封装（React Flow → X6 迁移）。
 *
 * - 生命周期：容器内 `new Graph`，节点 / 边即 X6 model（不再用 React state 镜像）；
 * - 加载：`fromJSON(toX6Cells(doc))` 一次性建图（id == cell id 零映射）；
 * - 变更：订阅 X6 model 事件 → `graphToDocument` 回写；命令（打组/解组/删除/边更新）走
 *   纯函数产出新文档 → 重建图；
 * - 只读渲染（readonly）服务 F1 三用：不建编辑插件、`interacting:false`；
 * - 卡片经 `@antv/x6-react-shape` portal provider 落在本 React 树内，context 穿透。
 */

export type CanvasGraphHandle = {
  get graph(): Graph | null;
  reload: (document: CanvasDocument) => void;
  addElement: (element: CanvasElementDTO) => void;
  updateEdge: (edge: CanvasEdgeDTO) => void;
  deleteElement: (elementId: string) => void;
  deleteEdge: (edgeId: string) => void;
  groupSelection: (nodeIds: string[]) => void;
  ungroupSelection: (groupIds: string[]) => void;
  deleteGroup: (groupId: string) => void;
  exportPng: () => Promise<void>;
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  /** 从工具栏 / 理解库等拖拽源发起一次 X6 Dnd 拖拽（source 元素由 element 描述） */
  startDrag: (element: CanvasElementDTO, event: React.PointerEvent | React.MouseEvent) => void;
};

export type CanvasGraphProps = {
  readonly?: boolean;
  /** 拖拽入画布时，根据拖拽源元素生成一份“新”元素（重新分配 id / canvasId），避免落点与源共用同一 id */
  createElementForDrop?: (source: CanvasElementDTO) => CanvasElementDTO;
  document?: CanvasDocument | null;
  viewport?: CanvasViewport | null;
  viewportReady?: boolean;
  shapeData?: CanvasShapeData;
  onDocumentChange?: (document: CanvasDocument) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
  onSelectionChange?: (cellIds: string[]) => void;
  canvasId?: string;
  testId?: string;
  className?: string;
  style?: React.CSSProperties;
};

const CANVAS_SNAP_GRID = 10;
const EMPTY_DOC: CanvasDocument = { elements: [], edges: [] };

/** 级联删除集合：起点 + 全部后代（供命令式 removeCells）。 */
function collectCascadeIds(document: CanvasDocument, startId: string): string[] {
  const removed = new Set([startId]);
  let previous = 0;
  while (removed.size !== previous) {
    previous = removed.size;
    for (const element of document.elements) {
      if (element.parentId && removed.has(element.parentId)) removed.add(element.id);
    }
  }
  return [...removed];
}
// react-shape portal provider：渲染一次，让所有 react-shape 卡片落入本 React 树（context 穿透）
const ReactShapePortalProvider = ReactShapePortal() as React.FC<{ children?: React.ReactNode }>;

export const CanvasGraph = React.forwardRef<CanvasGraphHandle, CanvasGraphProps>(
  function CanvasGraph(props, ref: Ref<CanvasGraphHandle>) {
    const {
      readonly = false,
      createElementForDrop,
      document,
      viewport,
      viewportReady = true,
      shapeData = EMPTY_CANVAS_SHAPE_DATA,
      canvasId = "",
      onDocumentChange,
      onViewportChange,
      onSelectionChange,
      testId = "canvas-graph",
      className,
      style,
    } = props;

    const onDocumentChangeRef = useLatest(onDocumentChange);
    const onViewportChangeRef = useLatest(onViewportChange);
    const onSelectionChangeRef = useLatest(onSelectionChange);
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<Graph | null>(null);
    const dndRef = useRef<Dnd | null>(null);
    const suppressEmitRef = useRef(false);
    const emitPendingRef = useRef(false);
    const viewportAppliedRef = useRef(false);
    const appliedDocRef = useRef<CanvasDocument | null>(null);
    const readonlyRef = useRef(readonly);
    readonlyRef.current = readonly;
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

    const emitDocument = useCallback(() => {
      if (readonlyRef.current || suppressEmitRef.current) return;
      const graph = graphRef.current;
      if (!graph) return;
      onDocumentChangeRef.current?.(graphToDocument(graph));
    }, [onDocumentChangeRef]);

    const scheduleEmit = useCallback(() => {
      if (readonlyRef.current || suppressEmitRef.current) return;
      if (emitPendingRef.current) return;
      emitPendingRef.current = true;
      requestAnimationFrame(() => {
        emitPendingRef.current = false;
        emitDocument();
      });
    }, [emitDocument]);

    const applyViewport = useCallback((graph: Graph, vp: CanvasViewport) => {
      graph.zoom(vp.zoom, { absolute: true });
      graph.translate(vp.x || 0, vp.y || 0);
    }, []);

    const readViewport = useCallback((graph: Graph): CanvasViewport => {
      const t = graph.translate();
      return { x: t.tx, y: t.ty, zoom: graph.zoom() };
    }, []);

    const renderGraph = useCallback(
      (doc: CanvasDocument, emit: boolean) => {
        const graph = graphRef.current;
        if (!graph) return;
        // 程序化重建不进 History（否则把整幅图的删/增记为一条可撤销命令）
        graph.getPlugin<History>("history")?.disable();
        suppressEmitRef.current = true;
        const vp = readViewport(graph);
        graph.removeCells(graph.getCells());
        graph.fromJSON(toX6Cells(doc));
        applyViewport(graph, vp);
        suppressEmitRef.current = false;
        graph.getPlugin<History>("history")?.enable();
        if (emit) emitDocument();
        setSelectedEdgeId(null);
        setSelectedNodeIds([]);
      },
      [applyViewport, emitDocument, readViewport],
    );

    const rebuild = useCallback(
      (mutate: (doc: CanvasDocument) => CanvasDocument) => {
        const graph = graphRef.current;
        if (!graph) return;
        renderGraph(mutate(graphToDocument(graph)), true);
      },
      [renderGraph],
    );

    // 挂载：创建 Graph + 插件 + 事件订阅 + 首次加载
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      ensureCanvasShapes();
      const graph = new Graph({
        container,
        autoResize: true,
        // 左键= rubberband 框选；Space+拖拽=平移（X6 内置，兼末双功能）
        panning: { enabled: true, eventTypes: ["leftMouseDown"] },
        mousewheel: { enabled: true, factor: 1.2, zoomAtMousePosition: true },
        grid: {
          size: CANVAS_SNAP_GRID,
          visible: true,
          type: "dot",
          args: { color: "rgb(0 0 0 / 0.08)" },
        },
        virtual: true,
        async: true,
        interacting: readonlyRef.current ? false : { edgeLabelMovable: true, nodeMovable: true },
        preventDefaultDblClick: false,
        connecting: {
          snap: { radius: 50 },
          allowLoop: true,
          allowNode: true,
          allowEdge: false,
          allowPort: true,
          allowMulti: true,
          createEdge: () => toX6Edge(newEdgeDto(canvasId)),
        },
      });
      graphRef.current = graph;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__x6graph = graph;

      let dnd: Dnd | undefined;
      if (!readonlyRef.current) {
        graph.use(new Transform({ resizing: true }));
        graph.use(new Selection({ rubberband: true, multiple: true, showNodeSelectionBox: false }));
        graph.use(new Snapline({ enabled: true }));
        graph.use(new Clipboard());
        graph.use(new History());
        graph.use(new Keyboard({ global: true }));
        graph.use(new Export());
        const minimapHost = globalThis.document.createElement("div");
        minimapHost.style.position = "absolute";
        minimapHost.style.right = "12px";
        minimapHost.style.bottom = "12px";
        minimapHost.style.zIndex = "8";
        container.parentElement?.appendChild(minimapHost);
        graph.use(new MiniMap({ container: minimapHost, width: 200, height: 150 }));

        // 内置 Dnd：工具栏 / 理解库调 startDrag → 拖入画布；getDropNode 生成“新”元素避免 id 冲突
        dnd = new Dnd({
          target: graph,
          getDropNode: (draggingNode) => {
            const source = draggingNode.getData() as { element?: CanvasElementDTO } | undefined;
            if (!source?.element || !createElementForDrop) return draggingNode;
            // 用 graph.createNode 建落点节点：new Node() 会绕过注册表的 react-shape 继承，
            // 渲染回退成 base rect 标记（无 fo，卡片不渲染）
            return graph.createNode(nodeMetadataFor(createElementForDrop(source.element)));
          },
        });
        dndRef.current = dnd ?? null;

        // Backspace / Delete 删除选中（原 RF deleteKeyCode），输入态不触发
        const onDelete = (e: KeyboardEvent) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("input, textarea, [contenteditable='true']")) return;
          const cells = graph.getSelectedCells();
          if (cells.length) graph.removeCells(cells);
        };
        const onCmd = (fn: () => void) => (e: KeyboardEvent) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("input, textarea, [contenteditable='true']")) return;
          e.preventDefault();
          fn();
        };
        graph.bindKey("backspace", onDelete);
        graph.bindKey("delete", onDelete);
        graph.bindKey(
          "mod+z",
          onCmd(() => graph.undo()),
        );
        graph.bindKey(
          "mod+shift+z",
          onCmd(() => graph.redo()),
        );
        graph.bindKey(
          "mod+c",
          onCmd(() => graph.copy(graph.getSelectedCells())),
        );
        graph.bindKey(
          "mod+v",
          onCmd(() => graph.paste()),
        );
      }
      dndRef.current = dnd ?? null;

      const modelEvents = [
        "node:change:position",
        "node:change:size",
        "node:change:parent",
        "node:added",
        "node:removed",
        "edge:added",
        "edge:removed",
        "edge:change:attrs",
        "edge:change:labels",
        "edge:change:connector",
        "edge:change:router",
        "history:undo",
        "history:redo",
      ] as const;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modelEvents.forEach((name) => graph.on(name, scheduleEmit as any));

      const emitViewport = () => {
        if (readonlyRef.current || suppressEmitRef.current) return;
        onViewportChangeRef.current?.(readViewport(graph));
      };
      graph.on("scale", emitViewport);
      graph.on("translate", emitViewport);

      const selection = graph.getPlugin<Selection>("selection");
      if (selection) {
        selection.on("selection:changed", ({ selected }) => {
          const cellIds = selected.map((cell) => cell.id);
          setSelectedNodeIds(cellIds.filter((id) => graph.getCellById(id)?.isNode()));
          setSelectedEdgeId(cellIds.find((id) => graph.getCellById(id)?.isEdge()) ?? null);
          onSelectionChangeRef.current?.(cellIds);
        });
      }

      // X6 Selection 插件不处理边点击选中：单独监听，选中边并清空节点选区
      graph.on("edge:click", ({ edge }) => {
        if (readonlyRef.current) return;
        graph.getPlugin<Selection>("selection")?.reset([]);
        setSelectedNodeIds([]);
        setSelectedEdgeId(edge.id);
        onSelectionChangeRef.current?.([edge.id]);
      });

      const doc = document ?? EMPTY_DOC;
      appliedDocRef.current = doc;
      suppressEmitRef.current = true;
      graph.fromJSON(toX6Cells(doc));
      suppressEmitRef.current = false;
      if (viewportReady && !viewportAppliedRef.current) {
        viewportAppliedRef.current = true;
        if (viewport) applyViewport(graph, viewport);
        else graph.zoomToFit({ padding: 20, maxScale: 1 });
      }

      return () => {
        graph.dispose();
        graphRef.current = null;
        dndRef.current?.dispose();
        dndRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 外部 document 变化（审批应用 / 只读预览更新）→ 重建图；首次挂载除外（已加载）。
    useEffect(() => {
      if (!document || !graphRef.current) return;
      if (appliedDocRef.current === document) return;
      appliedDocRef.current = document;
      renderGraph(document, false);
    }, [document, renderGraph]);

    useImperativeHandle(
      ref,
      () => ({
        get graph() {
          return graphRef.current;
        },
        reload: (nextDocument: CanvasDocument) => renderGraph(nextDocument, false),
        addElement: (element: CanvasElementDTO) => {
          // 命令式加节点：进 History，可供 undo；node:added 事件回写文档
          const graph = graphRef.current;
          if (!graph) return;
          // 弃置的 pointerdown 拖拽会遗留未闭合的 'dnd' batch（自动化点击无 real drop），
          // 先闭合它，History 才能把本次 add 记为独立可撤销命令。
          const model = graph.model as unknown as {
            batches?: Record<string, number>;
            stopBatch: (name: string) => void;
          };
          if (model.batches?.["dnd"]) model.stopBatch("dnd");
          const cell = graph.addNode(nodeMetadataFor(element));
          if (cell) graph.centerCell(cell);
        },
        updateEdge: (edge: CanvasEdgeDTO) =>
          rebuild((doc) => ({
            ...doc,
            edges: doc.edges.map((e) => (e.id === edge.id ? edge : e)),
          })),
        deleteElement: (elementId: string) => {
          const graph = graphRef.current;
          if (!graph) return;
          const doomed = collectCascadeIds(graphToDocument(graph), elementId);
          graph.removeCells(doomed.map((id) => graph.getCellById(id)).filter(Boolean));
        },
        deleteEdge: (edgeId: string) => {
          const graph = graphRef.current;
          const cell = graph?.getCellById(edgeId);
          if (graph && cell) graph.removeCells([cell]);
        },
        groupSelection: (nodeIds: string[]) =>
          rebuild((doc) =>
            groupElements(doc, nodeIds, {
              id: crypto.randomUUID(),
              canvasId,
              createdAt: new Date().toISOString(),
            }),
          ),
        ungroupSelection: (groupIds: string[]) => rebuild((doc) => ungroupGroups(doc, groupIds)),
        deleteGroup: (groupId: string) => {
          const graph = graphRef.current;
          if (!graph) return;
          const doomed = collectCascadeIds(graphToDocument(graph), groupId);
          graph.removeCells(doomed.map((id) => graph.getCellById(id)).filter(Boolean));
        },
        exportPng: async () => {
          graphRef.current?.exportPNG("reflecta-canvas.png");
        },
        zoomIn: () => graphRef.current?.zoom(1.2),
        zoomOut: () => graphRef.current?.zoom(0.8),
        fitView: () => graphRef.current?.zoomToFit({ padding: 40, maxScale: 1 }),
        startDrag: (element, event) => {
          const dnd = dndRef.current;
          const graph = graphRef.current;
          if (!dnd || !graph || readonlyRef.current) return;
          // graph.createNode：避免 new Node() 绕过 react-shape 继承导致落点卡片不渲染
          dnd.start(graph.createNode(nodeMetadataFor(element)), event.nativeEvent);
        },
      }),
      [canvasId, rebuild, renderGraph],
    );

    const handleElementUpdate = useCallback(
      (element: CanvasElementDTO) =>
        rebuild((doc) => ({
          ...doc,
          elements: doc.elements.map((e) => (e.id === element.id ? element : e)),
        })),
      [rebuild],
    );
    const handleEdgeUpdate = useCallback(
      (edge: CanvasEdgeDTO) =>
        rebuild((doc) => ({
          ...doc,
          edges: doc.edges.map((e) => (e.id === edge.id ? edge : e)),
        })),
      [rebuild],
    );

    const onCellAction = useCallback(
      (action: CanvasCellAction) => {
        if (action.type === "delete-element") {
          const graph = graphRef.current;
          if (graph) graph.removeCells([graph.getCellById(action.nodeId)].filter(Boolean));
        } else if (action.type === "delete-group") {
          const graph = graphRef.current;
          if (graph) {
            const doomed = collectCascadeIds(graphToDocument(graph), action.nodeId);
            graph.removeCells(doomed.map((id) => graph.getCellById(id)).filter(Boolean));
          }
        } else if (action.type === "ungroup") rebuild((doc) => ungroupGroups(doc, [action.nodeId]));
        else if (action.type === "delete-edge") {
          const graph = graphRef.current;
          const cell = graph?.getCellById(action.edgeId);
          if (graph && cell) graph.removeCells([cell]);
        }
      },
      [rebuild],
    );

    const multiSelected = !readonly && selectedNodeIds.length >= 2;
    const graph = graphRef.current;

    return (
      <CanvasShapeDataProvider value={{ ...shapeData, readonly, multiSelected, onCellAction }}>
        <CanvasElementUpdateProvider value={handleElementUpdate}>
          <CanvasEdgeUpdateProvider value={handleEdgeUpdate}>
            {/** react-shape 卡片经此 host 落入本 React 树（不包 children，只承载 portal） */}
            <ReactShapePortalProvider />
            <div
              ref={containerRef}
              className={cn("absolute inset-0 overflow-hidden", className)}
              style={style}
              data-testid={testId}
            />
            {graph && !readonly ? (
              <EdgeOverlay
                graph={graph}
                edgeId={selectedEdgeId}
                readonly={readonly}
                onUpdate={handleEdgeUpdate}
                onDelete={(edgeId) =>
                  rebuild((doc) => ({
                    ...doc,
                    edges: doc.edges.filter((e) => e.id !== edgeId),
                  }))
                }
              />
            ) : null}
            {multiSelected ? (
              <SelectionToolbar
                selectedCount={selectedNodeIds.length}
                onGroup={() =>
                  rebuild((doc) =>
                    groupElements(doc, selectedNodeIds, {
                      id: crypto.randomUUID(),
                      canvasId,
                      createdAt: new Date().toISOString(),
                    }),
                  )
                }
                onDelete={() => rebuild((doc) => deleteElements(doc, selectedNodeIds))}
              />
            ) : null}
          </CanvasEdgeUpdateProvider>
        </CanvasElementUpdateProvider>
      </CanvasShapeDataProvider>
    );
  },
);

function SelectionToolbar({
  selectedCount,
  onGroup,
  onDelete,
}: {
  selectedCount: number;
  onGroup: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-testid="canvas-selection-toolbar"
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-md border bg-background p-1 shadow-sm"
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="nodrag nopan"
        aria-label="打组"
        title="打组"
        data-testid="canvas-selection-group-button"
        disabled={selectedCount < 2}
        onClick={onGroup}
      >
        <Group size={14} />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="nodrag nopan text-destructive"
        aria-label="删除"
        title="删除"
        data-testid="canvas-selection-delete-button"
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
