import { lazy, Suspense, useEffect, useState } from "react";
import { m, MotionConfig } from "motion/react";
import { cn } from "../lib/utils";
import { EASE_OUT_EXPO } from "../lib/motion";
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

/** 骨架节点：卡片逐个浮现（artifact 生成感），内部行占位带光带流动。 */
function SkeletonNode({ className }: { className: string }) {
  return (
    <m.div
      className={cn(
        "absolute rounded-md border border-border bg-muted/40 p-2 shadow-sm",
        className,
      )}
      variants={{
        hidden: { opacity: 0, y: 8, scale: 0.96 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.32, ease: EASE_OUT_EXPO },
        },
      }}
    >
      <div className="skeleton-line mb-1.5 h-1.5 w-3/4 rounded-full" />
      <div className="skeleton-line h-1.5 w-1/2 rounded-full" />
    </m.div>
  );
}

/** 模拟画布最终图布局的骨架：节点逐个浮现 + 行光带流动，表达「AI 正在生成结构」。 */
export function ReadOnlyCanvasSkeleton() {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-md border border-border bg-muted/30"
      data-testid="canvas-view-skeleton"
      aria-hidden="true"
    >
      {/* 连接线（静态）：暗示节点之间的关系 */}
      <div className="absolute left-[38%] top-[22%] h-px w-28 -rotate-12 bg-foreground/10" />
      <div className="absolute left-[52%] top-[46%] h-px w-24 rotate-45 bg-foreground/10" />
      <div className="absolute left-[72%] top-[82%] h-px w-28 -rotate-6 bg-foreground/10" />
      <MotionConfig reducedMotion="user">
        <m.div
          className="absolute inset-0"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
          }}
        >
          <SkeletonNode className="left-[6%] top-[12%] h-14 w-36" />
          <SkeletonNode className="left-[42%] top-[4%] h-14 w-40" />
          <SkeletonNode className="left-[63%] top-[36%] h-14 w-32" />
          <SkeletonNode className="left-[18%] top-[60%] h-14 w-36" />
          <SkeletonNode className="left-[52%] top-[72%] h-14 w-40" />
          <SkeletonNode className="left-[74%] top-[66%] h-12 w-28" />
        </m.div>
      </MotionConfig>
    </div>
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
