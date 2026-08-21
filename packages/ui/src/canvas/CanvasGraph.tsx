import { useLatest } from "ahooks";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type ReactFlowInstance,
  type Viewport,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
import { Group, Trash2 } from "lucide-react";
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";
import {} from "../components/context-menu";
import { Button } from "../components/button";
import { cn } from "../lib/utils";
import type { CanvasDocument, CanvasViewport } from "./document";
import {
  newEdgeDto,
  toCanvasDocument,
  toFlowData,
  toFlowEdge,
  toGroupNodeStyle,
} from "./graph-document";
import { canvasNodeTypes } from "./nodes";
import { canvasPaintColor } from "./color-swatches";
import { getDndElement } from "./dnd";
import { canvasEdgeTypes } from "./edges";
import { deleteGroupBranch, groupSelectedNodes, ungroupNodes } from "./graph-operations";
import {
  appendCanvasConnection,
  reduceCanvasEdgeChanges,
  reduceCanvasNodeChanges,
} from "./canvas-graph-bridge";
import type { CanvasEdgeDTO, CanvasElementDTO } from "./document";
import {
  CanvasElementUpdateProvider,
  CanvasEdgeUpdateProvider,
  CanvasShapeDataProvider,
  EMPTY_CANVAS_SHAPE_DATA,
  type CanvasShapeData,
} from "./shape-context";

/**
 * React Flow 画布封装。
 *
 * - 生命周期：ReactFlowProvider 包裹，节点 / 边受控 state，模板与交互全走 React Flow 原生；
 * - 文档加载：`document` prop 首次 / 外部刷新 → toFlowData（元素 id == node id 零映射）；
 * - 变更桥：节点拖动 / 尺寸 / 删除、连线新增 / 删除、视图缩放平移 → document / viewport 回写；
 * - 只读渲染（readonly）服务 F1 三用组件（引用 Modal / draft 预览 / artifact 缩略）。
 *
 * 设计约束：不针对产品逻辑做引擎级定制——交互用 React Flow 原生 prop / API，
 * 数据层只做 document ↔ nodes/edges 的直映射。
 */

export type CanvasGraphHandle = {
  get graph(): ReactFlowInstance | null;
  /** 外部变更（审批应用）后全量刷新：从 document 重建图 */
  reload: (document: CanvasDocument) => void;
  /** 向画布添加一个元素（画布引用创建等命令式入口） */
  addElement: (element: import("./document").CanvasElementDTO) => void;
  updateEdge: (edge: CanvasEdgeDTO) => void;
  deleteElement: (elementId: string) => void;
  deleteEdge: (edgeId: string) => void;
  groupSelection: (nodeIds: string[]) => void;
  ungroupSelection: (groupIds: string[]) => void;
  deleteGroup: (groupId: string) => void;
  exportPng: () => Promise<void>;
};

export type CanvasGraphProps = {
  /** 只读渲染：禁用编辑交互（F1 只读渲染器共用，保留平移缩放） */
  readonly?: boolean;
  /** 初始 / 外部文档；内部编辑经事件桥流出，不回灌 */
  document?: CanvasDocument | null;
  /** 视口（恢复）：初始 / 外部刷新提供；配合 viewportReady 在 detail 就绪后应用 */
  viewport?: CanvasViewport | null;
  /** detail 已就绪（否则不应用视口 / 不 fitView，避免抢跑覆盖已存视口） */
  viewportReady?: boolean;
  /** 节点展示数据注入（理解卡全文 / 画布引用标题 / 动作） */
  shapeData?: CanvasShapeData;
  /** 语义事件桥：交互后的完整文档回写（防抖保存由调用方负责） */
  onDocumentChange?: (document: CanvasDocument) => void;
  /** 视口 settle 后回写 */
  onViewportChange?: (viewport: CanvasViewport) => void;
  /** 选中变化回写（右侧面板 / 搜索消费）；含边选中 */
  onSelectionChange?: (cellIds: string[]) => void;
  /** canvasId：新建连线初始 DTO 归属 */
  canvasId?: string;
  /** 主容器 testid（嵌套预览传不同值，避免严格模式选择器撞名） */
  testId?: string;
  className?: string;
  style?: CSSProperties;
};

const nodeTypes = canvasNodeTypes;
// 10px snap：节点尺寸是 20 的倍数时，中心落在 10px 网格上；
// 若 snap 也是 20，两张不同高度的卡片中心永远无法在 x 轴上对齐（连线必然有拐角）。
// 改成 10 后，默认尺寸（120 / 220 等）的中心都落在同一 10px 网格上，可对齐成直线。
const CANVAS_SNAP_GRID: [number, number] = [10, 10];
const DND_MIME = "application/reflecta-canvas-element";
const CANVAS_EDGE_STATE_CLASS =
  "[&_.react-flow__edge:hover]:[--canvas-edge-stroke:var(--primary)] [&_.react-flow__edge:hover]:[--xy-edge-stroke:var(--primary)] [&_.react-flow__edge.selected]:[--xy-edge-stroke:var(--primary)] [&_.react-flow__edge.selected]:[--xy-edge-stroke-selected:var(--primary)]";
// 组外壳用 RF 内置 `.react-flow__node-group`（padding / 边框 / 底 / 选中阴影），
// 只把官方色值换成设计 token；type 叫 group 才会吃到这套皮。
const CANVAS_GROUP_CLASS = [
  "[--xy-node-border:1px_solid_var(--border)]",
  "[--xy-node-border-radius:var(--radius-lg)]",
  "[--xy-node-group-background-color:color-mix(in_oklch,var(--muted)_40%,transparent)]",
  "[--xy-node-boxshadow-selected:0_0_0_2px_var(--ring)]",
  "[--xy-node-boxshadow-hover:0_1px_4px_1px_color-mix(in_oklch,var(--foreground)_8%,transparent)]",
  "[&_.react-flow__node-group]:text-left",
  "[&_.react-flow__node-group.dragging]:opacity-80",
].join(" ");

/**
 * 选区工具栏：跟随选中节点集合，锚定到选区上方的屏幕坐标。
 * 用 useViewport 订阅视口 → 平移 / 缩放时仅此小组件重算位置，选区工具条跟着图形走。
 */
function SelectionToolbar({
  nodes,
  selectedNodeIds,
  onGroup,
  onDelete,
}: {
  nodes: Node[];
  selectedNodeIds: string[];
  onGroup: () => void;
  onDelete: () => void;
}) {
  const viewport = useViewport();
  if (selectedNodeIds.length < 2) return null;
  const selectedIdSet = new Set(selectedNodeIds);
  const selected = nodes.filter((n) => selectedIdSet.has(n.id));
  if (selected.length === 0) return null;
  const bounds = getNodesBounds(selected);
  const left = (bounds.x + bounds.width / 2) * viewport.zoom + viewport.x;
  const top = bounds.y * viewport.zoom + viewport.y;
  return (
    <div
      data-testid="canvas-selection-toolbar"
      className="absolute z-10 flex items-center gap-1 rounded-md border bg-background p-1 shadow-sm"
      style={{ left, top, transform: "translate(-50%, -100%)" }}
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="nodrag nopan"
        aria-label="打组"
        title="打组"
        data-testid="canvas-selection-group-button"
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

function useCanvasFlow(props: CanvasGraphProps, ref: Ref<CanvasGraphHandle>) {
  const {
    readonly = false,
    document,
    viewport,
    viewportReady = true,
    shapeData = EMPTY_CANVAS_SHAPE_DATA,
    canvasId = "",
    onDocumentChange,
    onViewportChange,
    onSelectionChange,
  } = props;

  const instance = useReactFlow();
  const onDocumentChangeRef = useLatest(onDocumentChange);
  const onViewportChangeRef = useLatest(onViewportChange);
  const onSelectionChangeRef = useLatest(onSelectionChange);
  const applyingInitialViewportRef = useRef(false);

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => toFlowData(document ?? { elements: [], edges: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时取初始文档
    [],
  );

  const [nodes, setNodes] = useNodesState<Node>(initNodes);
  const [edges, setEdges] = useEdgesState<Edge>(initEdges);
  // 选中节点跟踪：selection 工具条（多选打组）消费；readonly 下不维护。
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  // 双击连线发起的标签编辑：边组件据 id 开启内联编辑，结束后清空以便再次进入。
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const nodesRef = useLatest(nodes);
  const edgesRef = useLatest(edges);

  // DnD 落点预览：拖入时跟随光标的虚线占位框（不生成节点、不写文档）。
  // 用一个常驻、默认透明度 0 的占位框，位置/尺寸/显隐全走 DOM style，
  // 避免首次 dragover 时 setState 渲染出左上角 (0,0) 的闪一下。
  const containerRef = useRef<HTMLDivElement>(null);
  const dropPreviewRef = useRef<HTMLDivElement>(null);
  const dragElementRef = useRef<CanvasElementDTO | null>(null);

  const emitDocument = useCallback(() => {
    if (readonly) return;
    onDocumentChangeRef.current?.(toCanvasDocument(nodesRef.current, edgesRef.current));
  }, [edgesRef, nodesRef, onDocumentChangeRef, readonly]);

  // 节点变化：位置 / 尺寸 / 删除 → 同步文档
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const { nodes: next, documentChanged } = reduceCanvasNodeChanges(nodesRef.current, changes);
      nodesRef.current = next;
      setNodes(next);
      if (documentChanged) emitDocument();
    },
    [emitDocument, nodesRef, setNodes],
  );

  // 边变化：删除 → 同步文档
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const { edges: next, documentChanged } = reduceCanvasEdgeChanges(edgesRef.current, changes);
      edgesRef.current = next;
      setEdges(next);
      if (documentChanged) emitDocument();
    },
    [edgesRef, emitDocument, setEdges],
  );

  // 连线完成：新增边 → 同步文档
  const handleConnect: OnConnect = useCallback(
    (conn: Connection) => {
      const next = appendCanvasConnection(edgesRef.current, conn, (connection) => {
        const dto = newEdgeDto(canvasId);
        return toFlowEdge({
          ...dto,
          sourceElementId: connection.source!,
          targetElementId: connection.target!,
        });
      });
      if (next === edgesRef.current) return;
      edgesRef.current = next;
      setEdges(next);
      emitDocument();
    },
    [canvasId, edgesRef, emitDocument, setEdges],
  );

  // 视口变化回写
  const handleOnViewportChange = useCallback(
    (v: Viewport) => {
      if (readonly) return;
      if (applyingInitialViewportRef.current) return;
      onViewportChangeRef.current?.({ x: v.x, y: v.y, zoom: v.zoom });
    },
    [onViewportChangeRef, readonly],
  );

  // 选中变化回写
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      if (readonly) return;
      setSelectedNodeIds(selectedNodes.map((n) => n.id));
      onSelectionChangeRef.current?.([
        ...selectedNodes.map((n) => n.id),
        ...selectedEdges.map((e) => e.id),
      ]);
    },
    [onSelectionChangeRef, readonly],
  );

  // 内容编辑（文本 / 组名）回写：更新受控 data + 同步文档
  const handleElementUpdate = useCallback(
    (element: CanvasElementDTO) => {
      const next = nodesRef.current.map((n) =>
        n.id === element.id ? { ...n, data: { element }, style: toGroupNodeStyle(element) } : n,
      );
      nodesRef.current = next;
      setNodes(next);
      emitDocument();
    },
    [emitDocument, nodesRef, setNodes],
  );

  const handleEdgeUpdate = useCallback(
    (edge: CanvasEdgeDTO) => {
      const next = edgesRef.current.map((current) =>
        current.id === edge.id ? { ...toFlowEdge(edge), selected: current.selected } : current,
      );
      edgesRef.current = next;
      setEdges(next);
      emitDocument();
    },
    [edgesRef, emitDocument, setEdges],
  );

  const updateNodes = useCallback(
    (next: Node[]) => {
      nodesRef.current = next;
      setNodes(next);
      emitDocument();
    },
    [emitDocument, nodesRef, setNodes],
  );

  const deleteElement = useCallback(
    (elementId: string) => {
      const nextNodes = nodesRef.current.filter((node) => node.id !== elementId);
      if (nextNodes.length === nodesRef.current.length) return;
      const nextEdges = edgesRef.current.filter(
        (edge) => edge.source !== elementId && edge.target !== elementId,
      );
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      emitDocument();
    },
    [edgesRef, emitDocument, nodesRef, setEdges, setNodes],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      const next = edgesRef.current.filter((edge) => edge.id !== edgeId);
      if (next.length === edgesRef.current.length) return;
      edgesRef.current = next;
      setEdges(next);
      emitDocument();
    },
    [edgesRef, emitDocument, setEdges],
  );

  const groupSelection = useCallback(
    (nodeIds: string[]) => {
      const now = new Date().toISOString();
      const next = groupSelectedNodes(nodesRef.current, nodeIds, {
        id: crypto.randomUUID(),
        canvasId,
        createdAt: now,
      });
      if (next === nodesRef.current) return;
      updateNodes(next);
    },
    [canvasId, nodesRef, updateNodes],
  );

  const ungroupSelection = useCallback(
    (groupIds: string[]) => {
      const next = ungroupNodes(nodesRef.current, groupIds);
      if (next === nodesRef.current) return;
      updateNodes(next);
    },
    [nodesRef, updateNodes],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      const next = deleteGroupBranch(nodesRef.current, edgesRef.current, groupId);
      if (next.nodes === nodesRef.current) return;
      nodesRef.current = next.nodes;
      edgesRef.current = next.edges;
      setNodes(next.nodes);
      setEdges(next.edges);
      emitDocument();
    },
    [edgesRef, emitDocument, nodesRef, setEdges, setNodes],
  );

  const exportPng = useCallback(async () => {
    const viewportElement = globalThis.document.querySelector<HTMLElement>(".react-flow__viewport");
    const graphElement = globalThis.document.querySelector<HTMLElement>(
      "[data-testid='canvas-graph']",
    );
    if (!viewportElement || !graphElement || nodesRef.current.length === 0) return;
    const width = Math.max(640, graphElement.clientWidth);
    const height = Math.max(480, graphElement.clientHeight);
    const bounds = getNodesBounds(nodesRef.current);
    const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, 0.1);
    const dataUrl = await toPng(viewportElement, {
      backgroundColor: "white",
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
      filter: (node) => !node.classList?.contains("react-flow__background"),
    });
    const link = globalThis.document.createElement("a");
    link.download = "reflecta-canvas.png";
    link.href = dataUrl;
    link.click();
  }, [nodesRef]);

  // 文档加载：document prop 为「初始 / 外部刷新」数据源，变化时重建 nodes/edges。
  // 内部编辑经 onDocumentChange 流出，不回灌 document prop（防循环）。
  useEffect(() => {
    if (!document) return;
    const { nodes: nextNodes, edges: nextEdges } = toFlowData(document);
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [document, edgesRef, nodesRef, setNodes, setEdges]);

  // 暴露实例与外部刷新能力
  useImperativeHandle(
    ref,
    () => ({
      get graph() {
        return instance;
      },
      reload: (nextDocument: CanvasDocument) => {
        const { nodes: nextNodes, edges: nextEdges } = toFlowData(nextDocument);
        nodesRef.current = nextNodes;
        edgesRef.current = nextEdges;
        setNodes(nextNodes);
        setEdges(nextEdges);
      },
      updateEdge: handleEdgeUpdate,
      deleteElement,
      deleteEdge,
      groupSelection,
      ungroupSelection,
      deleteGroup,
      exportPng,
      addElement: (element: import("./document").CanvasElementDTO) => {
        const node: Node = {
          id: element.id,
          type: element.kind,
          position: { x: 60, y: 60 },
          width: element.width,
          height: element.height,
          zIndex: element.zIndex,
          data: { element },
        };
        const next = [...nodesRef.current, node];
        nodesRef.current = next;
        setNodes(next);
        emitDocument();
        instance.fitView({
          nodes: [node],
          padding: 0.5,
          maxZoom: 1,
          duration: 200,
        });
      },
    }),
    [
      deleteGroup,
      emitDocument,
      exportPng,
      groupSelection,
      handleEdgeUpdate,
      deleteElement,
      deleteEdge,
      instance,
      setNodes,
      setEdges,
      ungroupSelection,
      edgesRef,
      nodesRef,
    ],
  );

  // 视口：detail 就绪后再决定——有已存 viewport 则恢复，否则 fitView。
  // 避免 detail 未到时 fitView 抢跑并触发回写覆盖已存视口。
  useEffect(() => {
    if (!viewportReady) return;
    applyingInitialViewportRef.current = true;
    if (viewport) {
      instance.setViewport({
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      });
    } else {
      instance.fitView({ padding: 0.2, maxZoom: 1 });
    }
    const frame = requestAnimationFrame(() => {
      applyingInitialViewportRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [viewport, viewportReady, instance]);

  // DnD 落点预览：占位框跟随光标（首次 dragover 从暂存读元素尺寸 / 颜色）。
  const moveDropPreview = useCallback(
    (e: React.DragEvent) => {
      const container = containerRef.current;
      const preview = dropPreviewRef.current;
      if (!container || !preview) return;
      // dataTransfer.getData 在 dragover 阶段读不到（仅 drop 可读），
      // 因此用源在 dragstart 写入的暂存元素 + types 判定的组合来初始化预览。
      if (!dragElementRef.current && e.dataTransfer.types.includes(DND_MIME)) {
        const element = getDndElement();
        if (element) dragElementRef.current = element;
      }
      const element = dragElementRef.current;
      if (!element) return;
      const zoom = instance.getZoom();
      const rect = container.getBoundingClientRect();
      // 按 zoom 缩放，占位框落地的屏幕尺寸与真实节点一致；左上角对齐光标（= drop 落点）。
      preview.style.width = `${element.width * zoom}px`;
      preview.style.height = `${element.height * zoom}px`;
      preview.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;
      preview.style.borderColor = canvasPaintColor(element.props.color) ?? "var(--primary)";
      preview.style.opacity = "1";
    },
    [instance],
  );
  const clearDropPreview = useCallback(() => {
    dragElementRef.current = null;
    const preview = dropPreviewRef.current;
    if (preview) preview.style.opacity = "0";
  }, []);

  // DnD：外部（工具栏 / 库面板）拖入 → addNode；dragover 时显示落点预览。
  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!readonly) moveDropPreview(e);
    },
    [moveDropPreview, readonly],
  );
  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      // 移入容器后代（节点 / 后台等）也会触发 dragleave；用坐标判断指针是否真离开容器，
      // 避免 relatedTarget 为 null 时误清除预览。
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) clearDropPreview();
    },
    [clearDropPreview],
  );
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      clearDropPreview();
      const raw = e.dataTransfer.getData(DND_MIME);
      if (!raw || readonly) return;
      try {
        const element = JSON.parse(raw) as import("./document").CanvasElementDTO;
        const position = instance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        const node: Node = {
          id: element.id,
          type: element.kind,
          position,
          width: element.width,
          height: element.height,
          zIndex: element.zIndex,
          data: { element },
        };
        const next = [...nodesRef.current, node];
        nodesRef.current = next;
        setNodes(next);
        emitDocument();
      } catch {
        // ignore malformed payload
      }
    },
    [clearDropPreview, emitDocument, instance, nodesRef, readonly, setNodes],
  );

  // 多选：选区工具栏显示于选区上方，各节点隐藏独立操作工具栏。
  const multiSelected = !readonly && selectedNodeIds.length >= 2;
  const shapeContextValue = useMemo(
    () => ({
      ...shapeData,
      readonly,
      multiSelected,
      editingEdgeId,
      onEdgeEditEnd: () => setEditingEdgeId(null),
    }),
    [shapeData, readonly, multiSelected, editingEdgeId],
  );

  // 删除整个选区（含被选组的所有后代）。
  const deleteSelection = useCallback(() => {
    const toDelete = new Set(selectedNodeIds);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodesRef.current) {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          grew = true;
        }
      }
    }
    const nextNodes = nodesRef.current.filter((n) => !toDelete.has(n.id));
    if (nextNodes.length === nodesRef.current.length) return;
    const nextEdges = edgesRef.current.filter(
      (e) => !toDelete.has(e.source) && !toDelete.has(e.target),
    );
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds([]);
    emitDocument();
  }, [edgesRef, emitDocument, nodesRef, selectedNodeIds, setEdges, setNodes]);

  return {
    readonly: props.readonly ?? false,
    className: props.className,
    style: props.style,
    testId: props.testId ?? "canvas-graph",
    containerRef,
    dropPreviewRef,
    nodes,
    edges,
    selectedNodeIds,
    shapeContextValue,
    handleElementUpdate,
    handleEdgeUpdate,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleSelectionChange,
    handleOnViewportChange,
    setEditingEdgeId,
    onDragOver,
    onDragLeave,
    onDrop,
    groupSelection,
    deleteSelection,
  };
}

const CanvasFlow = forwardRef<CanvasGraphHandle, CanvasGraphProps>(function CanvasFlow(props, ref) {
  const flow = useCanvasFlow(props, ref);
  const {
    readonly,
    className,
    style,
    testId,
    containerRef,
    dropPreviewRef,
    nodes,
    edges,
    selectedNodeIds,
    shapeContextValue,
    handleElementUpdate,
    handleEdgeUpdate,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleSelectionChange,
    handleOnViewportChange,
    setEditingEdgeId,
    onDragOver,
    onDragLeave,
    onDrop,
    groupSelection,
    deleteSelection,
  } = flow;

  // 选区工具栏：位置由 SelectionToolbar 组件内的 useViewport 实时派生，平移 / 缩放跟随。

  return (
    <CanvasShapeDataProvider value={shapeContextValue}>
      <CanvasElementUpdateProvider value={handleElementUpdate}>
        <CanvasEdgeUpdateProvider value={handleEdgeUpdate}>
          <div
            ref={containerRef}
            className={cn("relative", CANVAS_EDGE_STATE_CLASS, CANVAS_GROUP_CLASS, className)}
            style={style}
            data-testid={testId}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={canvasEdgeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onSelectionChange={handleSelectionChange}
              onEdgeDoubleClick={(_, edge) => {
                if (readonly) return;
                setEditingEdgeId(edge.id);
              }}
              onViewportChange={handleOnViewportChange}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              selectionOnDrag
              selectionMode={SelectionMode.Partial}
              onlyRenderVisibleElements
              panOnDrag={[1]}
              panOnScroll
              snapToGrid
              snapGrid={CANVAS_SNAP_GRID}
              nodesDraggable={!readonly}
              nodesConnectable={!readonly}
              elementsSelectable={!readonly}
              deleteKeyCode={readonly ? null : "Backspace"}
            >
              <Background gap={20} size={1} color="rgb(0 0 0 / 0.08)" />
              <SelectionToolbar
                nodes={nodes}
                selectedNodeIds={selectedNodeIds}
                onGroup={() => groupSelection(selectedNodeIds)}
                onDelete={deleteSelection}
              />
              {!readonly ? (
                <MiniMap
                  position="bottom-right"
                  pannable
                  zoomable
                  bgColor="var(--muted)"
                  nodeColor="var(--card)"
                  nodeStrokeColor="var(--border)"
                  nodeStrokeWidth={1}
                  maskColor="color-mix(in oklch, var(--background) 85%, transparent)"
                  maskStrokeColor="var(--ring)"
                  maskStrokeWidth={1}
                />
              ) : null}
            </ReactFlow>
            {!readonly ? (
              <div
                ref={dropPreviewRef}
                data-testid="canvas-drop-preview"
                className="pointer-events-none absolute left-0 top-0 z-[5] rounded-lg border-2 border-dashed bg-background/60 opacity-0"
                style={{ width: 220, height: 120, borderColor: "var(--primary)" }}
              />
            ) : null}
          </div>
        </CanvasEdgeUpdateProvider>
      </CanvasElementUpdateProvider>
    </CanvasShapeDataProvider>
  );
});

export const CanvasGraph = forwardRef<CanvasGraphHandle, CanvasGraphProps>(
  function CanvasGraph(props, ref) {
    return (
      <ReactFlowProvider>
        <CanvasFlow {...props} ref={ref} />
      </ReactFlowProvider>
    );
  },
);
