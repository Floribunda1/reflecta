import { ReadOnlyCanvasCard } from "../../canvas/readonly-canvas-card";
import type { AgentCanvasViewBlock } from "./types";

export type AgentCanvasViewProps = {
  block: AgentCanvasViewBlock;
};

/** 独立只读分析画布视图：AI 分析 · 未保存，不进入 artifact panel。 */
export function AgentCanvasView({ block }: AgentCanvasViewProps) {
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
      <ReadOnlyCanvasCard
        document={block.document}
        understandingRefs={block.understandingRefs}
        understandingTitles={block.understandingTitles}
        className="h-72"
      />
    </div>
  );
}
