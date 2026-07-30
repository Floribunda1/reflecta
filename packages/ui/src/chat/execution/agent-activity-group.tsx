import { ChevronRight } from "lucide-react";
import { Badge } from "../../components/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import type { ChatEntityBindings } from "../entity";
import { activityGroupPresentation } from "./activity-presentation";
import { AgentExecutionBlock } from "./agent-execution-block";
import { AgentWorkingIndicator } from "./agent-working-indicator";
import type { AgentActivityBlockView } from "./types";

export type AgentActivityGroupProps = {
  blocks: readonly AgentActivityBlockView[];
  defaultExpanded?: boolean;
  entityBindings?: ChatEntityBindings;
};

export function AgentActivityGroup({
  blocks,
  defaultExpanded = false,
  entityBindings,
}: AgentActivityGroupProps) {
  const presentation = activityGroupPresentation(blocks);
  if (presentation.stepCount === 0) return null;

  return (
    <Collapsible
      defaultOpen={defaultExpanded}
      data-testid="agent-activity-group"
      className="group/activity my-1 min-w-0 w-full"
    >
      <CollapsibleTrigger
        data-testid="agent-activity-group-trigger"
        className="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <ChevronRight className="size-3 shrink-0 transition-transform group-data-[panel-open]:rotate-90" />
        <Badge variant="secondary" className="tabular-nums">
          {presentation.stepCount}
        </Badge>
        {presentation.running ? (
          <>
            <AgentWorkingIndicator aria-hidden="true" />
            <span className="sr-only">执行中</span>
          </>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{presentation.latestSummary}</span>
        {presentation.errorCount > 0 ? (
          <span className="shrink-0 text-[11px] text-destructive">
            {presentation.errorCount} 个错误
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-[13px] border-l-2 border-border/60 py-0.5 pl-4 pr-2">
          {blocks.map((block) => (
            <AgentExecutionBlock
              key={block.kind === "reasoning" ? block.reasoning.id : block.activity.id}
              block={block}
              entityBindings={entityBindings}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
