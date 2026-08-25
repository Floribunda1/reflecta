import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card";
import { ReadOnlyCanvasCard } from "../../canvas/readonly-canvas-card";
import type { AgentCanvasViewBlock } from "./types";

export type AgentCanvasViewProps = {
  block: AgentCanvasViewBlock;
};

/** 独立只读分析画布视图（shadcn Card 包裹）：不写入、不审批，不进入 artifact panel。 */
export function AgentCanvasView({ block }: AgentCanvasViewProps) {
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
          className="h-72"
        />
      </CardContent>
    </Card>
  );
}
