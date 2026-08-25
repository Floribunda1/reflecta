import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { m, MotionConfig } from "motion/react";
import { cn } from "../lib/utils";
import { EASE_OUT_EXPO, ENTER_DURATION, FADE_UP_Y, POP_IN_SCALE } from "../lib/motion";
import type { CanvasDocument } from "@reflecta/shared";
import type {
  CanvasReferencedCanvasView,
  CanvasShapeData,
  CanvasUnderstandingRefView,
} from "./shape-context";

// 重型 X6 只读图 lazy 引入：单测跑在 ESM 环境，X6 CJS lib 载入会炸；
// 且只在实际渲染时才需要 X6。Suspense fallback 作为「好看的加载」占位。
const CanvasReadOnlyView = lazy(() =>
  import("./CanvasReadOnlyView").then((m) => ({ default: m.CanvasReadOnlyView })),
);

/** 画布节点占位卡：逐个浮现 + 柔和高光扫过，保持纯视觉 loading。 */
function GraphNodeSkeleton({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <m.div
      className={cn(
        "absolute overflow-hidden rounded-md border border-border/80 bg-card/80 p-2 shadow-sm backdrop-blur-sm",
        className,
      )}
      variants={{
        hidden: { opacity: 0, y: FADE_UP_Y, scale: POP_IN_SCALE },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: ENTER_DURATION, ease: EASE_OUT_EXPO },
        },
      }}
    >
      <m.div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
        animate={{ x: ["-140%", "260%"] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "linear", delay }}
      />
      <div className="relative mb-1.5 h-1.5 w-3/4 rounded-full bg-muted-foreground/20" />
      <div className="relative h-1.5 w-1/2 rounded-full bg-muted-foreground/20" />
    </m.div>
  );
}

/** AI artifact 生成期加载态（Claude "Generating" 范式升级版，framer motion 全程驱动）：
 * 辐射光点 + 高光标题 + 迷你画布骨架（连线逐步绘制、节点逐个浮现）+ 不定态进度条。 */
export function ReadOnlyCanvasSkeleton() {
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border border-border bg-background"
        data-testid="canvas-view-skeleton"
        aria-hidden="true"
      >
        {/* 只增加空间感，不表达任何真实进度。 */}
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl"
          animate={{ scale: [1, 1.06, 1], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* 标题：辐射光点 + 高光文字 */}
        <div className="relative z-10 mb-1 flex items-center gap-2">
          <span className="relative block h-3.5 w-3.5">
            <m.span
              className="absolute inset-0 rounded-full border border-primary/25"
              animate={{ scale: [1, 1.9], opacity: [0.55, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="absolute inset-1 rounded-full bg-primary" />
          </span>
          <p className="shimmer-text text-sm font-medium">正在生成分析画布</p>
        </div>
        <p className="relative z-10 text-xs text-muted-foreground">
          梳理 Understanding 关系并自动排版
        </p>

        {/* 迷你画布骨架：静态结构 + 流动光点 */}
        <div className="relative z-10 mt-4 h-24 w-[min(420px,80vw)]">
          <svg
            className="absolute inset-0 h-full w-full text-border"
            viewBox="0 0 420 96"
            fill="none"
          >
            <path
              d="M84 48 L122 34 M218 34 L230 48 M326 48 L342 34"
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinecap="round"
            />
            <g className="text-primary/50">
              {["M84 48 L122 34", "M218 34 L230 48", "M326 48 L342 34"].map((path, index) => (
                <m.path
                  key={path}
                  d={path}
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeDasharray="1 13"
                  initial={{ strokeDashoffset: 0, opacity: 0 }}
                  animate={{ strokeDashoffset: -28, opacity: [0, 0.75, 0.75, 0] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.35,
                  }}
                />
              ))}
            </g>
          </svg>
          <m.div
            className="absolute inset-0"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
            }}
          >
            <GraphNodeSkeleton className="left-0 top-[30%] h-10 w-20" delay={0.1} />
            <GraphNodeSkeleton className="left-[28%] top-[14%] h-10 w-24" delay={0.5} />
            <GraphNodeSkeleton className="left-[54%] top-[30%] h-10 w-24" delay={0.9} />
            <GraphNodeSkeleton className="left-[80%] top-[14%] h-10 w-20" delay={1.3} />
          </m.div>
        </div>

        {/* 不定态装饰光带 */}
        <div className="relative z-10 mt-4 h-1 w-36 overflow-hidden rounded-full bg-muted">
          <m.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-primary/80"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </MotionConfig>
  );
}

function canvasShapeData(
  understandingRefs: ReadonlyMap<string, CanvasUnderstandingRefView> | undefined,
  understandingTitles: ReadonlyArray<{ id: string; title: string }> | undefined,
  referencedCanvases: ReadonlyMap<string, CanvasReferencedCanvasView> | undefined,
  onCanvasRefClick: ((canvasId: string) => void) | undefined,
): CanvasShapeData {
  // 引用展示数据（消息层实时 hydration）优先；不足时用 output 冻结的标题兜底，
  // 保证实体已被删除 / 重命名时引用卡仍有可读标签。
  const refs = new Map(understandingRefs);
  for (const title of understandingTitles ?? []) {
    if (!refs.has(title.id)) {
      refs.set(title.id, { id: title.id, title: title.title ?? null, body: "", deleted: false });
    }
  }
  return {
    understandingRefs: refs,
    referencedCanvases: referencedCanvases ?? new Map(),
    ...(onCanvasRefClick ? { onCanvasRefClick } : {}),
  };
}

export type ReadOnlyCanvasCardProps = {
  document: CanvasDocument;
  /** 引用理解的展示数据（优先，实时 hydration）。 */
  understandingRefs?: ReadonlyMap<string, CanvasUnderstandingRefView>;
  /** output / payload 冻结的引用标题（兜底，实体删除 / 重命名时仍有可读标签）。 */
  understandingTitles?: ReadonlyArray<{ id: string; title: string }>;
  /** 引用画布的展示数据（画布引用卡内嵌预览 / 删除占位）。 */
  referencedCanvases?: ReadonlyMap<string, CanvasReferencedCanvasView>;
  /** 画布引用卡点击跳转（如 inspector 需要在对话内打开目标画布）。 */
  onCanvasRefClick?: (canvasId: string) => void;
  /** false → 折叠占位，不挂载 X6（避免在 0 / 裁剪尺寸里初始化图的闪烁与损坏）。 */
  mounted?: boolean;
  className?: string;
};

/** 只读画布文档卡：封装 shape hydration + lazy X6 挂载 + 加载骨架 + 折叠策略。
 * 全屏走 portal 打到 body：消息列表虚拟化会给每条消息 wrapper 写 transform
 * （react-virtual directDomUpdates），transform 祖先会把 fixed inset-0 钉在消息条上
 * 而不是视口；portal 到 body 才能绕过。图随切换重建，CanvasReadOnlyView 已有
 * 布局落定后的 fitView，进入全屏自动适应视图。 */
export function ReadOnlyCanvasCard({
  document,
  understandingRefs,
  understandingTitles,
  referencedCanvases,
  onCanvasRefClick,
  mounted = true,
  className,
}: ReadOnlyCanvasCardProps) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const shapeData = canvasShapeData(
    understandingRefs,
    understandingTitles,
    referencedCanvases,
    onCanvasRefClick,
  );
  const content = mounted ? (
    <Suspense fallback={<ReadOnlyCanvasSkeleton />}>
      <CanvasReadOnlyView
        document={document}
        shapeData={shapeData}
        showZoomControls
        fullscreen={fullscreen}
        onFullscreenChange={setFullscreen}
        className="h-full min-h-0"
      />
    </Suspense>
  ) : null;
  if (fullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-50 overflow-hidden bg-background">{content}</div>,
      globalThis.document.body,
    );
  }
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-muted/30",
        className,
      )}
    >
      {content}
    </div>
  );
}
