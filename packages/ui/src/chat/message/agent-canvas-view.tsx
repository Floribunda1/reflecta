import { memo } from "react";
import { isEqual } from "lodash-es";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card";
import { Skeleton } from "../../components/skeleton";
import { ReadOnlyCanvasCard, ReadOnlyCanvasSkeleton } from "../../canvas/readonly-canvas-card";
import type { ChatEntityReference, MarkdownRenderer } from "../entity";
import type { AgentCanvasViewBlock } from "./types";

export type AgentCanvasViewProps = {
  block: AgentCanvasViewBlock;
  /** 理解卡正文的 Markdown 渲染：renderer 传入解析版组件（默认不解析）。 */
  renderMarkdown?: MarkdownRenderer;
  /** 理解/上下文 wiki link 点击（画布引用走 block 内嵌跳转）。 */
  onWikiLinkOpen?: (reference: ChatEntityReference) => void;
};

/** 独立只读分析画布视图（shadcn Card 包裹）：不写入、不审批，不进入 artifact panel。 */
export const AgentCanvasView = memo(
  function AgentCanvasView({ block, renderMarkdown, onWikiLinkOpen }: AgentCanvasViewProps) {
    const streaming = block.status === "streaming";
    return (
      <Card
        className="w-full"
        data-testid={streaming ? "agent-canvas-placeholder" : "agent-canvas-view"}
        data-block-id={block.id}
      >
        <CardHeader>
          {streaming ? (
            <>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </>
          ) : (
            <>
              <CardTitle>{block.title}</CardTitle>
              {block.caption ? <CardDescription>{block.caption}</CardDescription> : null}
            </>
          )}
        </CardHeader>
        <CardContent>
          {streaming ? (
            <div className="h-96 overflow-hidden rounded-md border border-border">
              <ReadOnlyCanvasSkeleton />
            </div>
          ) : (
            <ReadOnlyCanvasCard
              document={block.document}
              understandingRefs={block.understandingRefs}
              understandingTitles={block.understandingTitles}
              renderMarkdown={renderMarkdown}
              onWikiLinkOpen={onWikiLinkOpen}
              className="h-96"
            />
          )}
        </CardContent>
      </Card>
    );
  },
  (previous, next) =>
    previous.renderMarkdown === next.renderMarkdown &&
    previous.onWikiLinkOpen === next.onWikiLinkOpen &&
    isEqual(previous.block, next.block),
);
