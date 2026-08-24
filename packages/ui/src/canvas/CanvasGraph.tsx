import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Ref } from "react";
import {
  Clipboard,
  Dnd,
  Export,
  Graph,
  History,
  Keyboard,
  Selection,
  Snapline,
  Transform,
} from "@antv/x6";
import { getProvider as ReactShapePortal } from "@antv/x6-react-shape";
import { useLatest } from "ahooks";
import {
  BringToFront,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Group,
  SendToBack,
  Trash2,
  Ungroup,
} from "lucide-react";
import { Button } from "../components/button";
import { cn } from "../lib/utils";
import { ensureCanvasShapes } from "./nodes";
import type { CanvasCellAction } from "./shape-context";
import {
  DEFAULT_CANVAS_VIEWPORT,
  type CanvasDocument,
  type CanvasEdgeDTO,
  type CanvasElementDTO,
  type CanvasViewport,
} from "./document";
import {
  applyEdgePresentation,
  DEFAULT_CANVAS_EDGE_CONNECTOR,
  applyElementUpdate,
  ensureCanvasConnectors,
  toX6Cells,
  graphToDocument,
  newEdgeDto,
  toX6Edge,
  nodeMetadataFor,
} from "./graph-document";
import {
  absolutePositionOf,
  byId,
  cascadeIdsOf,
  groupElements,
  isSelectedWithAncestor,
  selectionRootIds,
} from "./graph-operations";
import { CanvasContextMenu, type CanvasContextMenuItem } from "./canvas-context-menu";
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
 * - 变更：订阅 X6 model 事件 → `graphToDocument` 回写；卡片内容 / 边样式原地改 cell，
 *   打组 / 解组走命令；整图重建只留给外部 document 替换（hydrate / reload）；
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
  focusCell: (cellId: string) => void;
};

type CanvasContextMenuTarget =
  | { kind: "nodes"; nodeIds: string[] }
  | { kind: "edge"; edgeId: string }
  | { kind: "blank" };

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
/**
 * X6 fromJSON 只恢复 child 的 parent 反指，不会重建父节点的 children 列表
 * （会话内 addChild 双向维护，重进后只有单向 → 解组 / 级联删除 / 组树全失效）。
 * 加载后按 parentId 统一补一次 addChild。
 */
function restoreChildLinks(graph: import("@antv/x6").Graph, doc: CanvasDocument) {
  const cells = new Map(graph.getCells().map((cell) => [cell.id, cell]));
  for (const element of doc.elements) {
    if (!element.parentId) continue;
    const parent = cells.get(element.parentId);
    const child = cells.get(element.id);
    if (parent?.isNode() && child?.isNode()) parent.addChild(child);
  }
}

// react-shape portal provider：渲染一次，让所有 react-shape 卡片落入本 React 树（context 穿透）
const ReactShapePortalProvider = ReactShapePortal() as React.FC<{ children?: React.ReactNode }>;

export const CanvasGraph = React.memo(
  React.forwardRef<CanvasGraphHandle, CanvasGraphProps>(function CanvasGraph(
    props,
    ref: Ref<CanvasGraphHandle>,
  ) {
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
    // 初始视口/布局只对“同一个 graph 实例”生效一次：StrictMode（dev）会重挂载组件，
    // 但 ref 跨两次挂载存活——按组件记 boolean 会把新 Graph 的首次 fitView 吞掉。
    const viewportAppliedRef = useRef<Graph | null>(null);
    const appliedDocRef = useRef<CanvasDocument | null>(null);
    const readonlyRef = useRef(readonly);
    readonlyRef.current = readonly;
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      target: CanvasContextMenuTarget;
    } | null>(null);

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
        if (suppressEmitRef.current) return;
        emitDocument();
      });
    }, [emitDocument]);

    const openContextMenu = useCallback(
      (clientX: number, clientY: number, target: CanvasContextMenuTarget) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setContextMenu({ x: clientX - rect.left, y: clientY - rect.top, target });
      },
      [],
    );
    const openContextMenuRef = useLatest(openContextMenu);

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
        restoreChildLinks(graph, doc);
        applyViewport(graph, vp);
        suppressEmitRef.current = false;
        graph.getPlugin<History>("history")?.enable();
        if (emit) emitDocument();
        setSelectedEdgeId(null);
        setSelectedNodeIds([]);
      },
      [applyViewport, emitDocument, readViewport],
    );

    // 挂载：创建 Graph + 插件 + 事件订阅 + 首次加载
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      ensureCanvasShapes();
      ensureCanvasConnectors();
      const graph = new Graph({
        container,
        autoResize: true,
        // X6 冲突规则：selection(rubberband) 与 panning 的 eventTypes+修饰键重叠时会
        // disablePanning。产品取互斥手势：左键=框选、中键拖拽=平移（Space 平移与左键框选不兼容）。
        panning: { enabled: true, eventTypes: ["mouseWheelDown"] },
        mousewheel: { enabled: true, factor: 1.2, zoomAtMousePosition: true },
        // 组内成员拖动限制在组 bbox 内（extent）；组自身可自由移动
        translating: {
          restrict: (view) => {
            const parent = view?.cell?.getParent?.();
            if (parent?.isNode()) return parent.getBBox().clone();
            return null;
          },
        },
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
          connector: DEFAULT_CANVAS_EDGE_CONNECTOR,
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
        graph.use(
          new Selection({
            rubberband: true,
            multiple: true,
            movingRouterFallback: "orth",
            showNodeSelectionBox: false,
            eventTypes: ["leftMouseDown"],
          }),
        );
        graph.use(new Snapline({ enabled: true }));
        graph.use(new Clipboard());
        graph.use(new History());
        graph.use(new Keyboard({ global: true }));
        graph.use(new Export());

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
        "edge:change:source",
        "edge:change:target",
        "node:change:data",
        "edge:change:data",
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
      // Transform 听 node:click 画缩放框；左键框选的 mouseup 会把 Selection 清成空，
      // React 操作条跟着没，缩放框却还在。点击节点后短时间忽略这次空选区。
      let retainCellId: string | null = null;
      const retainClickedCell = (cellId: string) => {
        retainCellId = cellId;
        queueMicrotask(() => {
          retainCellId = null;
        });
      };
      if (selection) {
        selection.on("selection:changed", ({ selected }) => {
          const cellIds = selected.map((cell) => cell.id);
          if (cellIds.length === 0 && retainCellId) {
            const cell = graph.getCellById(retainCellId);
            if (cell) selection.reset([cell]);
            return;
          }
          setSelectedNodeIds(cellIds.filter((id) => graph.getCellById(id)?.isNode()));
          setSelectedEdgeId(cellIds.find((id) => graph.getCellById(id)?.isEdge()) ?? null);
          onSelectionChangeRef.current?.(cellIds);
        });
      }

      graph.on("node:mousedown", ({ e }) => {
        e.stopPropagation?.();
      });
      graph.on("edge:mousedown", ({ e }) => {
        e.stopPropagation?.();
      });
      graph.on("node:click", ({ node, e }) => {
        if (readonlyRef.current) return;
        const plugin = graph.getPlugin<Selection>("selection");
        if (!plugin) return;
        retainClickedCell(node.id);
        if (e.metaKey || e.ctrlKey) {
          if (!plugin.isSelected(node)) plugin.select([node]);
        } else {
          plugin.reset([node]);
        }
      });
      graph.on("edge:click", ({ edge }) => {
        if (readonlyRef.current) return;
        retainClickedCell(edge.id);
        graph.getPlugin<Selection>("selection")?.reset([edge]);
      });
      graph.on("blank:click", () => {
        if (readonlyRef.current) return;
        graph.getPlugin<Selection>("selection")?.reset([]);
      });

      // 右键：节点→作用于整个多选（或单选该节点）；边→删边；空白→粘贴
      graph.on("node:contextmenu", ({ node, e }) => {
        if (readonlyRef.current) return;
        e.preventDefault?.();
        const selection = graph.getPlugin<Selection>("selection");
        let nodeIds: string[];
        if (selection?.isSelected(node)) {
          nodeIds = graph
            .getSelectedCells()
            .filter((cell) => cell.isNode())
            .map((cell) => cell.id);
        } else {
          selection?.reset([node]);
          nodeIds = [node.id];
        }
        openContextMenuRef.current(e.clientX, e.clientY, { kind: "nodes", nodeIds });
      });
      graph.on("edge:contextmenu", ({ edge, e }) => {
        if (readonlyRef.current) return;
        e.preventDefault?.();
        graph.getPlugin<Selection>("selection")?.reset([edge]);
        openContextMenuRef.current(e.clientX, e.clientY, { kind: "edge", edgeId: edge.id });
      });
      graph.on("blank:contextmenu", ({ e }) => {
        if (readonlyRef.current) return;
        e.preventDefault?.();
        graph.getPlugin<Selection>("selection")?.reset([]);
        openContextMenuRef.current(e.clientX, e.clientY, { kind: "blank" });
      });

      const doc = document ?? EMPTY_DOC;
      appliedDocRef.current = doc;
      suppressEmitRef.current = true;
      graph.fromJSON(toX6Cells(doc));
      suppressEmitRef.current = false;

      return () => {
        // dispose 会级联移除子单元（node:removed）→ 先压住 emit，避免把残文档存库
        suppressEmitRef.current = true;
        graph.dispose();
        graphRef.current = null;
        dndRef.current?.dispose();
        dndRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 视口恢复：详情（viewport）就绪后应用一次。挂载时 detail 可能仍在加载
    // （viewportReady=false），挂载 effect 不会重跑；这里在 props 就绪后补应用。
    // async:true 下渲染是异步的，立即 fitView 算不到内容 bbox；推迟一帧再 fit/恢复。
    // 空图 zoomToFit 会拧偏 translate，Dnd 的 client→graph 落点就漂。无内容用默认视口。
    // 初始布局不算用户操作，不 emit，避免把默认布局当成用户视口存库。
    // Dialog / 折叠容器首帧可能是 0 尺寸：等量到宽高再 fit，否则会锁死一次错误视口。
    // 只读查看允许放大铺满容器；编辑器仍 maxScale:1，避免一张卡撑满工作区。
    useEffect(() => {
      const graph = graphRef.current;
      const container = containerRef.current;
      if (!graph || !container || !viewportReady || viewportAppliedRef.current === graph) return;

      let raf = 0;
      let cancelled = false;
      const applyLayout = () => {
        if (cancelled || viewportAppliedRef.current === graph) return false;
        if (container.clientWidth <= 0 || container.clientHeight <= 0) return false;
        viewportAppliedRef.current = graph;
        raf = requestAnimationFrame(() => {
          if (cancelled || graphRef.current !== graph) return;
          suppressEmitRef.current = true;
          if (viewport) applyViewport(graph, viewport);
          else if (graph.getCells().length > 0) {
            graph.zoomToFit(readonlyRef.current ? { padding: 40 } : { padding: 20, maxScale: 1 });
          } else applyViewport(graph, DEFAULT_CANVAS_VIEWPORT);
          suppressEmitRef.current = false;
        });
        return true;
      };

      applyLayout();
      const observer = new ResizeObserver(() => {
        if (applyLayout()) observer.disconnect();
      });
      observer.observe(container);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        observer.disconnect();
      };
    }, [viewport, viewportReady, applyViewport]);

    // 外部 document 变化（审批应用 / 只读预览更新）→ 重建图；首次挂载除外（已加载）。
    useEffect(() => {
      if (!document || !graphRef.current) return;
      if (appliedDocRef.current === document) return;
      appliedDocRef.current = document;
      renderGraph(document, false);
    }, [document, renderGraph]);

    // 组操作统一走 graph 命令（History 记录 → 可撤销），与工具栏 / 右键 / 选区工具条共用。
    // 几何唯一来源是纯函数 groupElements（含 zIndex/parentId/相对坐标换算）；
    // 命令层只做 X6 绑定（addNode + addChild 进 History）。
    const runGroupSelection = (nodeIds: string[]) => {
      const graph = graphRef.current;
      if (!graph) return;
      const doc = graphToDocument(graph);
      const index = byId(doc.elements);
      const selected = new Set(nodeIds);
      if (
        doc.elements.filter(
          (element) =>
            selected.has(element.id) && !isSelectedWithAncestor(element.id, selected, index),
        ).length < 2
      )
        return;
      const groupId = crypto.randomUUID();
      const next = groupElements(doc, nodeIds, {
        id: groupId,
        canvasId,
        createdAt: new Date().toISOString(),
      });
      const groupDto = next.elements.find((element) => element.id === groupId);
      if (!groupDto) return;
      // 坐标约定：X6 内一律存绝对坐标（文档契约是相对坐标）。
      // 纯函数 groupElements 返回相对组坐标，落图前换算成绝对坐标。
      const nextIndex = byId(next.elements);
      const groupAbsolute = absolutePositionOf(groupDto, nextIndex);
      // History 以 batch 为一个可撤销步骤
      graph.startBatch("group");
      const groupNode = graph.addNode(
        nodeMetadataFor({ ...groupDto, x: groupAbsolute.x, y: groupAbsolute.y }),
      );
      // addChild 同时维护 child.parent 与 parent.children（setParent 只写 parent 一侧）
      for (const element of next.elements) {
        if (element.parentId !== groupId) continue;
        const child = graph.getCellById(element.id);
        if (child?.isNode()) groupNode.addChild(child);
      }
      graph.stopBatch("group");
    };

    const runUngroup = (groupIds: string[]) => {
      const graph = graphRef.current;
      if (!graph) return;
      const groups = groupIds
        .map((id) => graph.getCellById(id))
        .filter((cell): cell is import("@antv/x6").Node => Boolean(cell?.isNode()));
      if (groups.length === 0) return;
      graph.startBatch("ungroup");
      for (const group of groups) {
        const parent = group.getParent();
        for (const child of group.getChildren() ?? []) {
          if (parent?.isNode()) parent.addChild(child);
          else group.unembed(child); // X6 removeFromParent 会从图中删除；解组只要拆绑定
        }
        graph.removeCells([group]);
      }
      graph.stopBatch("ungroup");
    };

    /** 置顶/置底：原子单位=选中分支根，deep 连带后代；相邻边跟随端点。 */
    const runZMove = (nodeIds: string[], dir: "front" | "back") => {
      const graph = graphRef.current;
      if (!graph) return;
      const doc = graphToDocument(graph);
      const roots = selectionRootIds(doc, nodeIds);
      const nodes = roots
        .map((id) => graph.getCellById(id))
        .filter((cell): cell is import("@antv/x6").Node => Boolean(cell?.isNode()));
      if (nodes.length === 0) return;
      const affected = new Set(cascadeIdsOf(doc, roots));
      const edges = graph
        .getEdges()
        .filter(
          (edge) =>
            affected.has(edge.getSourceCellId() ?? "") ||
            affected.has(edge.getTargetCellId() ?? ""),
        );
      graph.startBatch("z-move");
      // 多层分支：置顶按层序升序、置底降序逐一移动，保留多分支相对序
      const ordered = [...nodes].sort((a, b) =>
        dir === "front" ? a.getZIndex() - b.getZIndex() : b.getZIndex() - a.getZIndex(),
      );
      for (const node of ordered) {
        if (dir === "front") node.toFront({ deep: true });
        else node.toBack({ deep: true });
      }
      for (const edge of edges) {
        if (dir === "front") edge.toFront();
        else edge.toBack();
      }
      graph.stopBatch("z-move");
      scheduleEmit(); // change:zIndex 不在 modelEvents 里，主动回写文档
    };

    const runCopy = (nodeIds: string[]) => {
      const graph = graphRef.current;
      const clipboard = graph?.getPlugin<Clipboard>("clipboard");
      if (!graph || !clipboard) return;
      const cells = nodeIds.map((id) => graph.getCellById(id)).filter(Boolean);
      clipboard.copy(cells, { deep: true });
    };

    const runDuplicate = (nodeIds: string[]) => {
      const graph = graphRef.current;
      const clipboard = graph?.getPlugin<Clipboard>("clipboard");
      if (!graph || !clipboard) return;
      const cells = nodeIds.map((id) => graph.getCellById(id)).filter(Boolean);
      clipboard.copy(cells, { deep: true });
      const pasted = clipboard.paste({ offset: { dx: 24, dy: 24 } });
      graph.getPlugin<Selection>("selection")?.reset(pasted);
    };

    const runDeleteNodes = (nodeIds: string[]) => {
      const graph = graphRef.current;
      if (!graph) return;
      const doomed = cascadeIdsOf(graphToDocument(graph), nodeIds);
      graph.removeCells(doomed.map((id) => graph.getCellById(id)).filter(Boolean));
    };

    const runDeleteEdge = (edgeId: string) => {
      const graph = graphRef.current;
      const cell = graph?.getCellById(edgeId);
      if (graph && cell) graph.removeCells([cell]);
    };

    const runPasteAt = () => {
      const graph = graphRef.current;
      const clipboard = graph?.getPlugin<Clipboard>("clipboard");
      if (!graph || !clipboard) return;
      const pasted = clipboard.paste();
      graph.getPlugin<Selection>("selection")?.reset(pasted);
    };

    const buildMenuSections = (): { items: CanvasContextMenuItem[] }[] => {
      if (!contextMenu) return [];
      const graph = graphRef.current;
      const { target } = contextMenu;
      if (target.kind === "blank") {
        return [
          {
            items: [
              {
                id: "paste",
                label: "粘贴",
                icon: ClipboardPaste,
                disabled: graph?.isClipboardEmpty() ?? true,
                onSelect: runPasteAt,
              },
            ],
          },
        ];
      }
      if (target.kind === "edge") {
        return [
          {
            items: [
              {
                id: "delete-edge",
                label: "删除连线",
                icon: Trash2,
                destructive: true,
                onSelect: () => runDeleteEdge(target.edgeId),
              },
            ],
          },
        ];
      }
      const nodeIds = target.nodeIds;
      const isGroup = (id: string) =>
        graph?.getCellById(id)?.isNode() &&
        (graph.getCellById(id)!.getData() as { element?: CanvasElementDTO } | null)?.element
          ?.kind === "group";
      const groupIds = nodeIds.filter(isGroup);
      const sections: { items: CanvasContextMenuItem[] }[] = [
        {
          items: [
            {
              id: "to-front",
              label: "置顶",
              icon: BringToFront,
              onSelect: () => runZMove(nodeIds, "front"),
            },
            {
              id: "to-back",
              label: "置底",
              icon: SendToBack,
              onSelect: () => runZMove(nodeIds, "back"),
            },
          ],
        },
        {
          items: [
            { id: "copy", label: "复制", icon: Copy, onSelect: () => runCopy(nodeIds) },
            {
              id: "duplicate",
              label: "重复",
              icon: CopyPlus,
              onSelect: () => runDuplicate(nodeIds),
            },
          ],
        },
      ];
      if (groupIds.length > 0) {
        sections.push({
          items: [
            { id: "ungroup", label: "解组", icon: Ungroup, onSelect: () => runUngroup(groupIds) },
          ],
        });
      }
      sections.push({
        items: [
          {
            id: "delete",
            label: groupIds.length > 0 ? "删除（含组内内容）" : "删除",
            icon: Trash2,
            destructive: true,
            onSelect: () => runDeleteNodes(nodeIds),
          },
        ],
      });
      return sections;
    };

    const handleElementUpdate = useCallback((element: CanvasElementDTO) => {
      const graph = graphRef.current;
      if (!graph) return;
      const cell = graph.getCellById(element.id);
      if (!cell?.isNode()) return;
      applyElementUpdate(cell, element);
    }, []);
    const handleEdgeUpdate = useCallback((edge: CanvasEdgeDTO) => {
      const graph = graphRef.current;
      if (!graph) return;
      const cell = graph.getCellById(edge.id);
      if (!cell?.isEdge()) return;
      graph.startBatch("edge-update");
      applyEdgePresentation(cell, edge);
      graph.stopBatch("edge-update");
    }, []);

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
        updateEdge: (edge: CanvasEdgeDTO) => handleEdgeUpdate(edge),
        deleteElement: (elementId: string) => {
          const graph = graphRef.current;
          if (!graph) return;
          const doomed = cascadeIdsOf(graphToDocument(graph), [elementId]);
          graph.removeCells(doomed.map((id) => graph.getCellById(id)).filter(Boolean));
        },
        deleteEdge: (edgeId: string) => {
          const graph = graphRef.current;
          const cell = graph?.getCellById(edgeId);
          if (graph && cell) graph.removeCells([cell]);
        },
        groupSelection: (nodeIds: string[]) => runGroupSelection(nodeIds),
        ungroupSelection: (groupIds: string[]) => runUngroup(groupIds),
        deleteGroup: (groupId: string) => {
          const graph = graphRef.current;
          if (!graph) return;
          const doomed = cascadeIdsOf(graphToDocument(graph), [groupId]);
          graph.removeCells(doomed.map((id) => graph.getCellById(id)).filter(Boolean));
        },
        exportPng: async () => {
          graphRef.current?.exportPNG("reflecta-canvas.png");
        },
        // X6 zoom(factor) 默认加法语义：显式 absolute 乘法，缩放控件才符合直觉
        zoomIn: () => {
          const g = graphRef.current;
          if (g) g.zoom(g.zoom() * 1.2, { absolute: true });
        },
        zoomOut: () => {
          const g = graphRef.current;
          if (g) g.zoom(g.zoom() * 0.8, { absolute: true });
        },
        fitView: () =>
          graphRef.current?.zoomToFit(
            readonlyRef.current ? { padding: 40 } : { padding: 40, maxScale: 1 },
          ),
        startDrag: (element, event) => {
          const dnd = dndRef.current;
          const graph = graphRef.current;
          if (!dnd || !graph || readonlyRef.current) return;
          // graph.createNode：避免 new Node() 绕过 react-shape 继承导致落点卡片不渲染
          dnd.start(graph.createNode(nodeMetadataFor(element)), event.nativeEvent);
        },
        focusCell: (cellId) => {
          const graph = graphRef.current;
          if (!graph) return;
          const cell = graph.getCellById(cellId);
          if (!cell) return;
          graph.centerCell(cell);
          graph.getPlugin<Selection>("selection")?.reset([cell]);
        },
      }),
      [handleEdgeUpdate, renderGraph, runGroupSelection, runUngroup],
    );

    const onCellAction = useCallback((action: CanvasCellAction) => {
      if (action.type === "delete-element") {
        const graph = graphRef.current;
        if (graph) graph.removeCells([graph.getCellById(action.nodeId)].filter(Boolean));
      } else if (action.type === "delete-group") {
        const graph = graphRef.current;
        if (graph) {
          const doomed = cascadeIdsOf(graphToDocument(graph), [action.nodeId]);
          graph.removeCells(doomed.map((id) => graph.getCellById(id)).filter(Boolean));
        }
      } else if (action.type === "ungroup") runUngroup([action.nodeId]);
      else if (action.type === "delete-edge") {
        const graph = graphRef.current;
        const cell = graph?.getCellById(action.edgeId);
        if (graph && cell) graph.removeCells([cell]);
      }
    }, []);

    const multiSelected = !readonly && selectedNodeIds.length >= 2;
    const selectedIds = useMemo(
      () => new Set<string>([...selectedNodeIds, ...(selectedEdgeId ? [selectedEdgeId] : [])]),
      [selectedEdgeId, selectedNodeIds],
    );
    const graph = graphRef.current;

    return (
      <CanvasShapeDataProvider
        value={{ ...shapeData, readonly, multiSelected, selectedIds, onCellAction }}
      >
        <CanvasElementUpdateProvider value={handleElementUpdate}>
          <CanvasEdgeUpdateProvider value={handleEdgeUpdate}>
            {/** react-shape 卡片经此 host 落入本 React 树（不包 children，只承载 portal） */}
            <ReactShapePortalProvider />
            <div
              ref={containerRef}
              className={cn("absolute inset-0 overflow-hidden", className)}
              style={style}
              data-testid={testId}
              data-canvas-graph=""
              data-readonly={readonly || undefined}
            />
            {graph && !readonly ? (
              <EdgeOverlay
                graph={graph}
                edgeId={selectedEdgeId}
                readonly={readonly}
                onUpdate={handleEdgeUpdate}
                onDelete={(edgeId) => {
                  const live = graphRef.current;
                  const cell = live?.getCellById(edgeId);
                  if (live && cell) live.removeCells([cell]);
                }}
              />
            ) : null}
            {multiSelected ? (
              <SelectionToolbar
                selectedCount={selectedNodeIds.length}
                onGroup={() => runGroupSelection(selectedNodeIds)}
                onDelete={() => {
                  const graph = graphRef.current;
                  if (graph)
                    graph.removeCells(
                      cascadeIdsOf(graphToDocument(graph), selectedNodeIds)
                        .map((id) => graph.getCellById(id))
                        .filter((cell): cell is import("@antv/x6").Cell => Boolean(cell)),
                    );
                }}
              />
            ) : null}
            {contextMenu && graph && !readonly ? (
              <CanvasContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                containerWidth={containerRef.current?.clientWidth ?? 0}
                onClose={() => setContextMenu(null)}
                sections={buildMenuSections()}
              />
            ) : null}
          </CanvasEdgeUpdateProvider>
        </CanvasElementUpdateProvider>
      </CanvasShapeDataProvider>
    );
  }),
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
