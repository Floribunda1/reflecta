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
      className="group/activity my-1 min-w-0 w-full rounded-lg border border-border/70 px-2.5"
    >
      <CollapsibleTrigger
        data-testid="agent-activity-group-trigger"
        className="group flex w-full cursor-pointer items-center gap-2 py-1.5 text-left text-[13px] text-foreground/75 transition-colors hover:text-foreground"
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
        <div className="pb-1 pl-9 pr-2">
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
