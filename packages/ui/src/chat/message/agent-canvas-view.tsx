import { lazy, Suspense } from "react";
import { Skeleton } from "../../components/skeleton";
import type { CanvasShapeData } from "../../canvas";
import type { AgentCanvasViewBlock } from "./types";

// 重型 X6 只读图 lazy 引入：把 suspense fallback 用作「好看的加载」占位，
// 只在文档已就绪、真正挂载时才拉 X6（deferred mount）。
const CanvasReadOnlyView = lazy(() =>
  import("../../canvas").then((m) => ({ default: m.CanvasReadOnlyView })),
);

/** 模拟画布最终图布局的骨架：若干 pulsing 卡片节点，表达「结构正在成形」。 */
function CanvasViewSkeleton() {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-muted/30"
      data-testid="canvas-view-skeleton"
      aria-hidden="true"
    >
      <Skeleton className="absolute left-[6%] top-[12%] h-14 w-36 rounded-md" />
      <Skeleton className="absolute left-[42%] top-[4%] h-14 w-40 rounded-md" />
      <Skeleton className="absolute left-[63%] top-[36%] h-14 w-32 rounded-md" />
      <Skeleton className="absolute left-[18%] top-[60%] h-14 w-36 rounded-md" />
      <Skeleton className="absolute left-[52%] top-[72%] h-14 w-40 rounded-md" />
      <Skeleton className="absolute left-[74%] top-[66%] h-12 w-28 rounded-md" />
      {/* 极简连接线，暗示节点之间的关系 */}
      <div className="absolute left-[38%] top-[22%] h-px w-28 -rotate-12 bg-border" />
      <div className="absolute left-[52%] top-[46%] h-px w-24 rotate-45 bg-border" />
      <div className="absolute left-[72%] top-[82%] h-px w-28 -rotate-6 bg-border" />
    </div>
  );
}

function shapeDataFor(block: AgentCanvasViewBlock): CanvasShapeData {
  const understandingRefs = new Map(block.understandingRefs);
  for (const title of block.understandingTitles ?? []) {
    if (!understandingRefs.has(title.id)) {
      understandingRefs.set(title.id, {
        id: title.id,
        title: title.title ?? null,
        body: "",
        deleted: false,
      });
    }
  }
  return { understandingRefs, referencedCanvases: new Map() };
}

export type AgentCanvasViewProps = {
  block: AgentCanvasViewBlock;
};

/** 独立只读分析画布视图：AI 分析 · 未保存，不进入 artifact panel。 */
export function AgentCanvasView({ block }: AgentCanvasViewProps) {
  const shapeData = shapeDataFor(block);
  return (
    <div className="w-full" data-testid="agent-canvas-view" data-block-id={block.id}>
      <div className="mb-2 flex min-w-0 items-center gap-2 px-1">
        <h3 className="truncate font-medium">{block.title}</h3>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          AI 分析 · 未保存
        </span>
      </div>
      {block.caption ? (
        <div className="mb-2 px-1 text-xs text-muted-foreground">{block.caption}</div>
      ) : null}
      <Suspense fallback={<CanvasViewSkeleton />}>
        <CanvasReadOnlyView
          document={block.document}
          shapeData={shapeData}
          showZoomControls
          className="h-72 min-h-0 rounded-lg border border-border bg-muted/30"
        />
      </Suspense>
    </div>
  );
}
