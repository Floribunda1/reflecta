import { ArrowUpRight } from "lucide-react";
import { Badge } from "../../components/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import type { ChatEntityBindings } from "../entity";
import { activityGroupPresentation } from "./activity-presentation";
import { AgentExecutionBlock } from "./agent-execution-block";
import { AgentWorkingIndicator } from "./agent-working-indicator";
import type { AgentActivityBlockView } from "./types";

export type AgentActivityGroupProps = {
  blocks: readonly AgentActivityBlockView[];
  active?: boolean;
  defaultExpanded?: boolean;
  entityBindings?: ChatEntityBindings;
};

export function AgentActivityGroup({
  blocks,
  active = false,
  defaultExpanded = false,
  entityBindings,
}: AgentActivityGroupProps) {
  const presentation = activityGroupPresentation(blocks, active);
  if (presentation.stepCount === 0) return null;

  return (
    <Collapsible
      defaultOpen={defaultExpanded}
      data-testid="agent-activity-group"
      className="group/activity my-1 min-w-0 w-full"
    >
      <CollapsibleTrigger
        data-testid="agent-activity-group-trigger"
        className="group flex w-full cursor-pointer items-center gap-2 rounded-lg py-1.5 pl-0 pr-2.5 text-left text-[13px] text-foreground/75 outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/40"
      >
        <Badge variant="outline" className="bg-background font-semibold tabular-nums shadow-xs">
          {presentation.stepCount}
        </Badge>
        {presentation.running ? (
          <>
            <AgentWorkingIndicator className="size-[18px] text-foreground/65" aria-hidden="true" />
            <span className="sr-only">执行中</span>
          </>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{presentation.summary}</span>
        {presentation.errorCount > 0 ? (
          <span className="shrink-0 text-[11px] text-destructive">
            {presentation.errorCount} 个错误
          </span>
        ) : null}
        <ArrowUpRight className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
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
