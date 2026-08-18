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
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CanvasDocument, CanvasViewport } from "./document";
import { newEdgeDto, toCanvasDocument, toFlowData } from "./graph-document";
import { canvasNodeTypes } from "./nodes";
import {
  CanvasElementUpdateProvider,
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
};

export type CanvasGraphMinimapOptions = {
  container: HTMLElement | null;
  width?: number;
  height?: number;
};

export type CanvasGraphProps = {
  /** 只读渲染：禁用编辑交互（F1 只读渲染器共用，保留平移缩放） */
  readonly?: boolean;
  /** 初始 / 外部文档；内部编辑经事件桥流出，不回灌 */
  document?: CanvasDocument | null;
  /** 视口（恢复）：挂载时 apply */
  viewport?: CanvasViewport | null;
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
  /** 右下缩略图（默认开启；container 仅作兼容占位） */
  minimap?: CanvasGraphMinimapOptions;
  className?: string;
  style?: CSSProperties;
};

const nodeTypes = canvasNodeTypes;

const CanvasFlow = forwardRef<CanvasGraphHandle, CanvasGraphProps>(function CanvasFlow(props, ref) {
  const {
    readonly = false,
    document,
    viewport,
    shapeData = EMPTY_CANVAS_SHAPE_DATA,
    canvasId = "",
    onDocumentChange,
    onViewportChange,
    onSelectionChange,
    minimap: _minimap,
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

  const documentRef = useRef<CanvasDocument | null>(null);
  const viewportAppliedRef = useRef(false);

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
      const edge: Edge = {
        id: dto.id,
        source: conn.source,
        target: conn.target,
        data: { edge: { ...dto, sourceElementId: conn.source, targetElementId: conn.target } },
      };
      const next = addEdge(edge, edgesRef.current);
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
    (element: import("./document").CanvasElementDTO) => {
      const next = nodesRef.current.map((n) =>
        n.id === element.id ? { ...n, data: { element } } : n,
      );
      nodesRef.current = next;
      setNodes(next);
      emitDocument();
    },
    [emitDocument, setNodes],
  );

  // 初始文档加载 + 外部刷新（document prop 变化）
  useEffect(() => {
    if (!documentRef.current && document) {
      documentRef.current = document;
    }
  }, [document]);

  // 暴露实例与外部刷新能力
  useImperativeHandle(
    ref,
    () => ({
      get graph() {
        return instance;
      },
      reload: (nextDocument: CanvasDocument) => {
        const { nodes: nextNodes, edges: nextEdges } = toFlowData(nextDocument);
        documentRef.current = nextDocument;
        nodesRef.current = nextNodes;
        edgesRef.current = nextEdges;
        setNodes(nextNodes);
        setEdges(nextEdges);
      },
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
        instance.fitView({ nodes: [node], padding: 0.5, maxZoom: 1, duration: 200 });
      },
    }),
    [instance, setNodes, setEdges],
  );

  // 视口恢复：挂载后应用一次
  useEffect(() => {
    if (!viewport || viewportAppliedRef.current) return;
    viewportAppliedRef.current = true;
    instance.setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时应用一次
  }, [viewport]);

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
        const position = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
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
        <div className={className} style={style} data-testid="canvas-graph">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onSelectionChange={handleSelectionChange}
            onViewportChange={handleOnViewportChange}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onInit={() => {
              // no-op: instance accessible via useReactFlow
            }}
            nodesDraggable={!readonly}
            nodesConnectable={!readonly}
            elementsSelectable={!readonly}
            deleteKeyCode={readonly ? null : "Delete"}
            connectionLineStyle={{ stroke: "#94a3b8", strokeWidth: 2 }}
            minZoom={0.25}
            maxZoom={4}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          >
            <Background gap={20} size={1} color="rgb(0 0 0 / 0.08)" />
            {!readonly ? <MiniMap position="bottom-right" pannable zoomable /> : null}
          </ReactFlow>
        </div>
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
