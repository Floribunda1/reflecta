import { lazy, Suspense, useEffect, useState } from "react";
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

/** 画布节点占位卡：逐个浮现（生成感）+ 内部行跳动。 */
function GraphNodeSkeleton({ className }: { className: string }) {
  return (
    <m.div
      className={cn(
        "absolute rounded-md border border-border bg-muted/40 p-2 shadow-sm",
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
      <div className="mb-1.5 h-1.5 w-3/4 animate-pulse rounded-full bg-muted-foreground/20" />
      <div className="h-1.5 w-1/2 animate-pulse rounded-full bg-muted-foreground/20" />
    </m.div>
  );
}

/** AI artifact 生成期加载态（Claude "Generating" 范式升级版，framer motion 全程驱动）：
 * 辐射光点 + 高光标题 + 迷你画布骨架（连线逐步绘制、节点逐个浮现）+ 不定态进度条。 */
export function ReadOnlyCanvasSkeleton() {
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border border-border bg-muted/30"
        data-testid="canvas-view-skeleton"
        aria-hidden="true"
      >
        {/* 标题：辐射光点 + 高光文字 */}
        <div className="mb-1 flex items-center gap-2">
          <span className="relative block h-3 w-3">
            <m.span
              className="absolute inset-0 rounded-full bg-accent/70"
              animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <m.span
              className="absolute inset-0 rounded-full bg-accent/50"
              animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
            <span className="absolute inset-1 rounded-full bg-accent" />
          </span>
          <p className="shimmer-text text-sm font-medium">正在生成分析画布</p>
        </div>
        <p className="text-xs text-muted-foreground">梳理 Understanding 关系并自动排版</p>

        {/* 迷你画布骨架：连线绘制 + 节点浮现 */}
        <div className="relative mt-2 h-[150px] w-[260px]">
          <svg
            className="absolute inset-0 h-full w-full text-border"
            viewBox="0 0 260 150"
            fill="none"
          >
            <m.path
              d="M74 33 L188 30"
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.15 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.2 }}
            />
            <m.path
              d="M58 52 L58 95"
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.15 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.32 }}
            />
            <m.path
              d="M200 50 L200 92"
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.15 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.44 }}
            />
            <m.path
              d="M86 118 L188 116"
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.15 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.56 }}
            />
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
            <GraphNodeSkeleton className="left-[3%] top-[6%] h-12 w-24" />
            <GraphNodeSkeleton className="left-[56%] top-[2%] h-12 w-28" />
            <GraphNodeSkeleton className="left-[6%] top-[60%] h-12 w-24" />
            <GraphNodeSkeleton className="left-[57%] top-[58%] h-12 w-28" />
          </m.div>
        </div>

        {/* 不定态进度条：光带往复扫过 */}
        <div className="relative mt-3 h-1 w-44 overflow-hidden rounded-full bg-muted">
          <m.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-accent"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
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
 * 全屏与 Understanding 的 focus 模式同理——同一实例用 CSS 拉满视口（fixed inset-0），
 * 不重建图；X6 autoResize 跟随容器尺寸，进入全屏后自动适应视图。 */
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
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-muted/30",
        fullscreen
          ? "fixed inset-0 z-50 h-auto overflow-hidden rounded-none border-0 bg-background"
          : className,
      )}
    >
      {mounted ? (
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
      ) : null}
    </div>
  );
}
