import { Graph, History, MiniMap } from "@antv/x6";
import { getProvider } from "@antv/x6-react-shape";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { CanvasDocument, CanvasViewport } from "./document";
import { documentToGraphData, graphToDocument } from "./graph-document";
import {
  CanvasShapeDataProvider,
  EMPTY_CANVAS_SHAPE_DATA,
  type CanvasShapeData,
} from "./shape-context";
import { shapeNameForKind } from "./shapes/shape-registry";

/**
 * X6 画布封装（计划 F2 / Phase 1 落地）：
 *
 * - 生命周期：挂载建图（点阵网格 / 平移 / 滚轮缩放 / embedding / History）、卸载 dispose；
 * - 文档加载：`document` prop 首次 / 外部刷新时 fromJSON（元素 / 连线 id == cell id 零映射）；
 * - 语义事件桥：`node/edge:change:*` 与增删 → 全量文档回写（onDocumentChange），
 *   `scale` / `translate` → 视口回写（onViewportChange），节点点击 → 选中回写（onSelectionChange）；
 * - 只读渲染（`interacting: false`）服务 F1 三用组件（[[cv:]] Modal / draft 预览 / artifact 缩略）。
 *
 * 注意：`document` prop 是「初始 / 外部」数据源；X6 手势后的内部状态经事件桥流出，
 * 不回流到 prop（防循环）。工作区以 `key={canvasId}` 重挂载切换画布。
 */

const PORTAL_PROVIDER = getProvider() as React.FC<{ children?: ReactNode }>;

export type CanvasGraphHandle = {
  get graph(): Graph | null;
  /** 外部变更（Phase 5 审批应用）后全量刷新：从 document 重建图 */
  reload: (document: CanvasDocument) => void;
};

export type CanvasGraphMinimapOptions = {
  container: HTMLElement | null;
  width?: number;
  height?: number;
};

export type CanvasGraphProps = {
  /** 只读渲染：禁用全部交互（F1 只读渲染器共用） */
  readonly?: boolean;
  /** 初始 / 外部文档（T3）；内部编辑经事件桥流出，不回灌 */
  document?: CanvasDocument | null;
  /** 视口（M1-5 恢复）：挂载时 zoom + translate */
  viewport?: CanvasViewport | null;
  /** react-shape 展示数据注入（理解卡全文 / 画布引用标题 / 单元格动作） */
  shapeData?: CanvasShapeData;
  /** 语义事件桥：X6 手势后的完整文档状态回写（防抖 saveCanvas 由调用方负责） */
  onDocumentChange?: (document: CanvasDocument) => void;
  /** 视口（平移 / 缩放）settle 后回写（updateViewport，M1-5 恢复） */
  onViewportChange?: (viewport: CanvasViewport) => void;
  /** 选中变化（单选 / 框选 / Shift 追加）回写（右侧面板 / 搜索消费） */
  onSelectionChange?: (cellIds: string[]) => void;
  /** 右下缩略图（M2-5）：传入容器元素即启用 MiniMap 插件 */
  minimap?: CanvasGraphMinimapOptions;
  className?: string;
  style?: CSSProperties;
};

export const CanvasGraph = forwardRef<CanvasGraphHandle, CanvasGraphProps>(
  function CanvasGraph(props, ref) {
    const {
      readonly = false,
      document,
      viewport,
      shapeData = EMPTY_CANVAS_SHAPE_DATA,
      onDocumentChange,
      onViewportChange,
      onSelectionChange,
      minimap,
      className,
      style,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<Graph | null>(null);
    const bridgeRef = useRef({ loading: false });
    const documentRef = useRef<CanvasDocument | null>(document ?? null);
    const onDocumentChangeRef = useRef(onDocumentChange);
    const onViewportChangeRef = useRef(onViewportChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const minimapRef = useRef<MiniMap | null>(null);
    const viewportAppliedRef = useRef(false);

    onDocumentChangeRef.current = onDocumentChange;
    onViewportChangeRef.current = onViewportChange;
    onSelectionChangeRef.current = onSelectionChange;

    // 生命周期：挂载建图、卸载释放
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const graph = new Graph({
        container,
        autoResize: true,
        // 元素右键菜单（组动作等）由 React ContextMenu 承载，禁用 X6 的拦截
        preventDefaultContextMenu: false,
        interacting: readonly ? false : undefined,
        grid: {
          size: 20,
          visible: true,
          type: "dot",
          args: { color: "rgb(0 0 0 / 0.08)", thickness: 1 },
        },
        panning: { enabled: true, eventTypes: ["leftMouseDown", "mouseWheel"] },
        mousewheel: {
          enabled: true,
          modifiers: ["ctrl", "meta"],
          minScale: 0.25,
          maxScale: 4,
          zoomAtMousePosition: true,
        },
        // 组 = embedding（M3-D）：仅组可作父容器，以中心命中找最深组
        embedding: {
          enabled: !readonly,
          findParent: "center",
          frontOnly: true,
          validate: ({ parent }: { parent: import("@antv/x6").Node }) =>
            (parent.getData() as { kind?: string } | undefined)?.kind === "group",
        },
        // 仅嵌入可视化
        highlighting: {
          embedding: { name: "stroke", args: { padding: -1, attrs: { stroke: "#8f8f8f" } } },
        },
        connecting: {
          snap: true,
          allowBlank: false,
          allowLoop: false,
          allowMulti: true,
          allowEdge: false,
          highlight: true,
          connector: "smooth",
        },
      });

      graphRef.current = graph;

      // 撤销重做（M7-2，会话内；Phase 1 起启用，覆盖全部变更类型）
      if (!readonly) {
        graph.use(new History({ enabled: true }));
      }

      // 事件桥：变更 → 全量文档回写（T3）
      const emitDocument = () => {
        if (bridgeRef.current.loading || readonly) return;
        onDocumentChangeRef.current?.(graphToDocument(graph));
      };
      const emitSelection = (cellId: string) => {
        if (readonly) return;
        onSelectionChangeRef.current?.([cellId]);
      };
      const emitViewport = () => {
        if (bridgeRef.current.loading || readonly) return;
        const zoom = graph.zoom();
        const translation = graph.translate();
        onViewportChangeRef.current?.({ x: translation.tx, y: translation.ty, zoom });
      };

      graph.on("node:change:*", emitDocument);
      graph.on("edge:change:*", emitDocument);
      graph.on("node:added", emitDocument);
      graph.on("node:removed", emitDocument);
      graph.on("edge:added", emitDocument);
      graph.on("edge:removed", emitDocument);
      graph.on("node:click", ({ cell }: { cell: import("@antv/x6").Cell }) =>
        emitSelection(cell.id),
      );
      graph.on("scale", emitViewport);
      graph.on("translate", emitViewport);

      return () => {
        minimapRef.current?.dispose();
        minimapRef.current = null;
        graph.dispose();
        graphRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 只读在挂载时决定；重建由上层 remount 触发
    }, []);

    // 初始文档加载 + 外部刷新（document prop 变化）
    useEffect(() => {
      const graph = graphRef.current;
      if (!graph || !document) return;
      if (documentRef.current === document) return;
      documentRef.current = document;

      bridgeRef.current.loading = true;
      graph.fromJSON(documentToGraphData(document, (element) => shapeNameForKind(element.kind)));
      // fromJSON 的 added/change 事件在同步栈内触发，loading 标记需延后复位
      queueMicrotask(() => {
        bridgeRef.current.loading = false;
      });
    }, [document]);

    // 视口恢复（M1-5）：挂载后应用一次
    useEffect(() => {
      const graph = graphRef.current;
      if (!graph || viewportAppliedRef.current || !viewport) return;
      viewportAppliedRef.current = true;
      bridgeRef.current.loading = true;
      graph.zoomTo(viewport.zoom);
      graph.translate(viewport.x, viewport.y);
      queueMicrotask(() => {
        bridgeRef.current.loading = false;
      });
    }, [viewport]);

    // 缩略图插件（M2-5）：容器就绪后挂载
    useEffect(() => {
      const graph = graphRef.current;
      const container = minimap?.container;
      if (!graph || readonly || !container) return;
      if (minimapRef.current) {
        minimapRef.current.dispose();
        minimapRef.current = null;
      }
      minimapRef.current = new MiniMap({
        container,
        width: minimap.width ?? 200,
        height: minimap.height ?? 140,
        padding: 8,
      });
      graph.use(minimapRef.current);
      return () => {
        minimapRef.current?.dispose();
        minimapRef.current = null;
      };
    }, [minimap?.container, minimap?.width, minimap?.height, readonly]);

    useImperativeHandle(
      ref,
      () => ({
        get graph() {
          return graphRef.current;
        },
        reload: (nextDocument: CanvasDocument) => {
          const graph = graphRef.current;
          if (!graph) return;
          bridgeRef.current.loading = true;
          documentRef.current = nextDocument;
          graph.fromJSON(
            documentToGraphData(nextDocument, (element) => shapeNameForKind(element.kind)),
          );
          queueMicrotask(() => {
            bridgeRef.current.loading = false;
          });
        },
      }),
      [],
    );

    return (
      <CanvasShapeDataProvider value={shapeData}>
        <div ref={containerRef} className={className} style={style} data-testid="canvas-graph" />
        {/* react-shape 节点通过 portal 渲染进 SVG 的 foreignObject；PortalProvider 只承载 portal（不渲染 children） */}
        <PORTAL_PROVIDER />
      </CanvasShapeDataProvider>
    );
  },
);
