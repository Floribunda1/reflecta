import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card";
import { ReadOnlyCanvasCard } from "../../canvas/readonly-canvas-card";
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
export function AgentCanvasView({ block, renderMarkdown, onWikiLinkOpen }: AgentCanvasViewProps) {
  return (
    <Card className="w-full" data-testid="agent-canvas-view" data-block-id={block.id}>
      <CardHeader>
        <CardTitle>{block.title}</CardTitle>
        {block.caption ? <CardDescription>{block.caption}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <ReadOnlyCanvasCard
          document={block.document}
          understandingRefs={block.understandingRefs}
          understandingTitles={block.understandingTitles}
          renderMarkdown={renderMarkdown}
          onWikiLinkOpen={onWikiLinkOpen}
          className="h-72"
        />
      </CardContent>
    </Card>
  );
}
