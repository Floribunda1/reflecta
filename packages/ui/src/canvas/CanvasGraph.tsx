import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
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
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";
import {} from "../components/context-menu";
import type { CanvasDocument, CanvasViewport } from "./document";
import { newEdgeDto, toCanvasDocument, toFlowData, toFlowEdge } from "./graph-document";
import { canvasNodeTypes } from "./nodes";
import { canvasEdgeTypes } from "./edges";
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
  className?: string;
  style?: CSSProperties;
};

const nodeTypes = canvasNodeTypes;
const CANVAS_SNAP_GRID: [number, number] = [20, 20];

const CanvasFlow = forwardRef<CanvasGraphHandle, CanvasGraphProps>(function CanvasFlow(props, ref) {
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
    className,
    style,
  } = props;

  const instance = useReactFlow();
  const onDocumentChangeRef = useRef(onDocumentChange);
  const onViewportChangeRef = useRef(onViewportChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onDocumentChangeRef.current = onDocumentChange;
  onViewportChangeRef.current = onViewportChange;
  onSelectionChangeRef.current = onSelectionChange;

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => toFlowData(document ?? { elements: [], edges: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时取初始文档
    [],
  );

  const [nodes, setNodes] = useNodesState<Node>(initNodes);
  const [edges, setEdges] = useEdgesState<Edge>(initEdges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const emitDocument = useCallback(() => {
    if (readonly) return;
    onDocumentChangeRef.current?.(toCanvasDocument(nodesRef.current, edgesRef.current));
  }, [readonly]);

  // 节点变化：位置 / 尺寸 / 删除 → 同步文档
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const relevant = changes.some(
        (c) => c.type === "position" || c.type === "dimensions" || c.type === "remove",
      );
      const next = applyNodeChanges(changes, nodesRef.current);
      nodesRef.current = next;
      setNodes(next);
      if (relevant) emitDocument();
    },
    [emitDocument, setNodes],
  );

  // 边变化：删除 → 同步文档
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const relevant = changes.some((c) => c.type === "remove");
      const next = applyEdgeChanges(changes, edgesRef.current);
      edgesRef.current = next;
      setEdges(next);
      if (relevant) emitDocument();
    },
    [emitDocument, setEdges],
  );

  // 连线完成：新增边 → 同步文档
  const handleConnect: OnConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const dto = newEdgeDto(canvasId);
      const edge = toFlowEdge({
        ...dto,
        sourceElementId: conn.source,
        targetElementId: conn.target,
      });
      const next = [...edgesRef.current, edge];
      edgesRef.current = next;
      setEdges(next);
      emitDocument();
    },
    [canvasId, emitDocument, setEdges],
  );

  // 视口变化回写
  const handleOnViewportChange = useCallback(
    (v: Viewport) => {
      if (readonly) return;
      onViewportChangeRef.current?.({ x: v.x, y: v.y, zoom: v.zoom });
    },
    [readonly],
  );

  // 选中变化回写
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      if (readonly) return;
      onSelectionChangeRef.current?.([
        ...selectedNodes.map((n) => n.id),
        ...selectedEdges.map((e) => e.id),
      ]);
    },
    [readonly],
  );

  // 内容编辑（文本 / 组名）回写：更新受控 data + 同步文档
  const handleElementUpdate = useCallback(
    (element: CanvasElementDTO) => {
      const next = nodesRef.current.map((n) =>
        n.id === element.id ? { ...n, data: { element } } : n,
      );
      nodesRef.current = next;
      setNodes(next);
      emitDocument();
    },
    [emitDocument, setNodes],
  );

  const handleEdgeUpdate = useCallback(
    (edge: CanvasEdgeDTO) => {
      const next = edgesRef.current.map((current) =>
        current.id === edge.id ? toFlowEdge(edge) : current,
      );
      edgesRef.current = next;
      setEdges(next);
      emitDocument();
    },
    [emitDocument, setEdges],
  );

  const updateNodes = useCallback(
    (next: Node[]) => {
      nodesRef.current = next;
      setNodes(next);
      emitDocument();
    },
    [emitDocument, setNodes],
  );

  const groupSelection = useCallback(
    (nodeIds: string[]) => {
      const selected = new Set(nodeIds);
      const candidates = nodesRef.current.filter((node) => selected.has(node.id));
      if (!candidates.length) return;
      const byId = new Map(nodesRef.current.map((node) => [node.id, node]));
      const absolutePosition = (node: Node): { x: number; y: number } => {
        if (!node.parentId) return node.position;
        const parent = byId.get(node.parentId);
        if (!parent) return node.position;
        const position = absolutePosition(parent);
        return {
          x: position.x + node.position.x,
          y: position.y + node.position.y,
        };
      };
      const boxes = candidates.map((node) => ({
        node,
        position: absolutePosition(node),
        width: node.measured?.width ?? node.width ?? 160,
        height: node.measured?.height ?? node.height ?? 100,
      }));
      const minX = Math.min(...boxes.map((box) => box.position.x));
      const minY = Math.min(...boxes.map((box) => box.position.y));
      const maxX = Math.max(...boxes.map((box) => box.position.x + box.width));
      const maxY = Math.max(...boxes.map((box) => box.position.y + box.height));
      const groupId = crypto.randomUUID();
      const now = new Date().toISOString();
      const group: Node = {
        id: groupId,
        type: "group",
        position: { x: minX - 24, y: minY - 44 },
        width: maxX - minX + 48,
        height: maxY - minY + 68,
        data: {
          element: {
            id: groupId,
            canvasId,
            parentId: null,
            x: minX - 24,
            y: minY - 44,
            width: maxX - minX + 48,
            height: maxY - minY + 68,
            zIndex: 0,
            createdAt: now,
            updatedAt: now,
            kind: "group",
            understandingId: null,
            canvasRefId: null,
            props: { label: "" },
          },
        },
      };
      const next = [
        { ...group, selected: true },
        ...nodesRef.current.map((node) => {
          const box = boxes.find((candidate) => candidate.node.id === node.id);
          if (!box) return node;
          return {
            ...node,
            selected: false,
            parentId: groupId,
            extent: "parent" as const,
            expandParent: true,
            position: {
              x: box.position.x - group.position.x,
              y: box.position.y - group.position.y,
            },
            data: {
              element: {
                ...(node.data as { element: CanvasElementDTO }).element,
                parentId: groupId,
              },
            },
          };
        }),
      ];
      updateNodes(next);
    },
    [canvasId, updateNodes],
  );

  const ungroupSelection = useCallback(
    (groupIds: string[]) => {
      const groups = new Set(groupIds);
      const byId = new Map(nodesRef.current.map((node) => [node.id, node]));
      const absolutePosition = (node: Node): { x: number; y: number } => {
        if (!node.parentId) return node.position;
        const parent = byId.get(node.parentId);
        if (!parent) return node.position;
        const position = absolutePosition(parent);
        return {
          x: position.x + node.position.x,
          y: position.y + node.position.y,
        };
      };
      const next = nodesRef.current
        .filter((node) => !groups.has(node.id))
        .map((node) => {
          if (!node.parentId || !groups.has(node.parentId)) return node;
          const position = absolutePosition(node);
          return {
            ...node,
            parentId: undefined,
            extent: undefined,
            expandParent: undefined,
            position,
            data: {
              element: {
                ...(node.data as { element: CanvasElementDTO }).element,
                parentId: null,
              },
            },
          };
        });
      updateNodes(next);
    },
    [updateNodes],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      const group = nodesRef.current.find((node) => node.id === groupId);
      if (!group) return;
      const removed = new Set([groupId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of nodesRef.current) {
          if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) {
            removed.add(node.id);
            changed = true;
          }
        }
      }
      const next = nodesRef.current.filter((node) => !removed.has(node.id));
      const nextEdges = edgesRef.current.filter(
        (edge) => !removed.has(edge.source) && !removed.has(edge.target),
      );
      nodesRef.current = next;
      edgesRef.current = nextEdges;
      setNodes(next);
      setEdges(nextEdges);
      emitDocument();
    },
    [emitDocument, setEdges, setNodes],
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
  }, []);

  // 文档加载：document prop 为「初始 / 外部刷新」数据源，变化时重建 nodes/edges。
  // 内部编辑经 onDocumentChange 流出，不回灌 document prop（防循环）。
  useEffect(() => {
    if (!document) return;
    const { nodes: nextNodes, edges: nextEdges } = toFlowData(document);
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [document, setNodes, setEdges]);

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
      exportPng,
      groupSelection,
      handleEdgeUpdate,
      instance,
      setNodes,
      setEdges,
      ungroupSelection,
    ],
  );

  // 视口：detail 就绪后再决定——有已存 viewport 则恢复，否则 fitView。
  // 避免 detail 未到时 fitView 抢跑并触发回写覆盖已存视口。
  useEffect(() => {
    if (!viewportReady) return;
    if (viewport) {
      instance.setViewport({
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      });
    } else {
      instance.fitView({ padding: 0.2, maxZoom: 1 });
    }
  }, [viewport, viewportReady, instance]);

  // DnD：外部（工具栏 / 库面板）拖入 → addNode
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/reflecta-canvas-element");
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
    [emitDocument, instance, readonly, setNodes],
  );

  return (
    <CanvasShapeDataProvider value={readonly ? { ...shapeData, readonly: true } : shapeData}>
      <CanvasElementUpdateProvider value={handleElementUpdate}>
        <CanvasEdgeUpdateProvider value={handleEdgeUpdate}>
          <div className={className} style={style} data-testid="canvas-graph">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={canvasEdgeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onSelectionChange={handleSelectionChange}
              onViewportChange={handleOnViewportChange}
              onDragOver={onDragOver}
              onDrop={onDrop}
              selectionOnDrag
              multiSelectionKeyCode="Control"
              selectionMode={SelectionMode.Partial}
              panOnDrag={false}
              panOnScroll
              snapToGrid
              snapGrid={CANVAS_SNAP_GRID}
              nodesDraggable={!readonly}
              nodesConnectable={!readonly}
              elementsSelectable={!readonly}
              deleteKeyCode={readonly ? null : "Backspace"}
            >
              <Background gap={20} size={1} color="rgb(0 0 0 / 0.08)" />
              {!readonly ? <MiniMap position="bottom-right" pannable zoomable /> : null}
            </ReactFlow>
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
