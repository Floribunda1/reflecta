import { Graph } from "@antv/x6";
import { getProvider, register } from "@antv/x6-react-shape";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { CanvasDocument, CanvasViewport } from "./document";

/**
 * X6 生命周期封装 + 语义事件桥（F2 / 计划 Phase 0 骨架）。
 *
 * - 挂载时创建 Graph（点阵网格 / 平移 / 滚轮缩放），卸载时 dispose；
 * - 对外暴露 `graph` 句柄（工具栏缩放、zoomToFit、fromJSON、插件注册等由上层通过句柄操作）；
 * - 语义事件桥以 props 声明（onDocumentChange / onViewportChange / onSelectionChange），
 *   X6 变更事件 → 文档回写的完整映射在 Phase 1 落地（元素 / 连线 id == X6 cell id，零映射）。
 *
 * 只读渲染（`interacting: false`）服务于 F1 三用组件（[[cv:]] Modal / draft 预览 / artifact 缩略）。
 */

const PORTAL_PROVIDER = getProvider() as React.FC<{ children?: ReactNode }>;

/** 骨架占位 shape：验证 react-shape（React 19 createRoot）渲染链路；Phase 1 以真实卡片替换 */
register({
  shape: "canvas-node-placeholder",
  component: () => (
    <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border bg-card text-xs text-muted-foreground">
      canvas
    </div>
  ),
});

export type CanvasGraphHandle = {
  /** 当前 Graph 实例（未挂载 / 已销毁时为 null） */
  get graph(): Graph | null;
};

export type CanvasGraphProps = {
  /** 只读渲染：禁用全部交互（F1 只读渲染器共用） */
  readonly?: boolean;
  /** 文档镜像（T3：X6 为交互 / 语义权威，zustand 文档 store 镜像；外部变更经 fromJSON 增量更新） */
  document?: CanvasDocument | null;
  /** 视口（M1-5 恢复） */
  viewport?: CanvasViewport | null;
  /** 语义事件桥：X6 手势后的完整文档状态回写（防抖 saveCanvas 由调用方负责） */
  onDocumentChange?: (document: CanvasDocument) => void;
  /** 视口（平移 / 缩放）settle 后回写（updateViewport，M1-5 恢复） */
  onViewportChange?: (viewport: CanvasViewport) => void;
  /** 选中变化（单选 / 框选 / Shift 追加）回写（右侧面板 / 搜索消费） */
  onSelectionChange?: (cellIds: string[]) => void;
  className?: string;
  style?: CSSProperties;
};

export const CanvasGraph = forwardRef<CanvasGraphHandle, CanvasGraphProps>(
  function CanvasGraph(props, ref) {
    const { readonly = false, className, style } = props;
    // 事件桥契约 props 在 Phase 1 接线（X6 变更 → 文档回写）；此处保留签名并显式标注未消费
    void props.document;
    void props.viewport;
    void props.onDocumentChange;
    void props.onViewportChange;
    void props.onSelectionChange;
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<Graph | null>(null);

    // 生命周期：挂载建图、卸载释放。回调签名保持稳定（事件桥在 Phase 1 接线）。
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const graph = new Graph({
        container,
        autoResize: true,
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
        // 基础连线配置（Phase 3 完整落地）
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

      return () => {
        graph.dispose();
        graphRef.current = null;
      };
      // 只读属性在挂载时决定；重建由上层 remount 触发
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        get graph() {
          return graphRef.current;
        },
      }),
      [],
    );

    return (
      <PORTAL_PROVIDER>
        <div ref={containerRef} className={className} style={style} data-testid="canvas-graph" />
      </PORTAL_PROVIDER>
    );
  },
);
