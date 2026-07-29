import { CheckCircle2, ChevronDown, TriangleAlert } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import { Spinner } from "../../components/spinner";
import type { ChatEntityBindings } from "../entity";
import { ChatMarkdown } from "../markdown/chat-markdown";
import type {
  AgentContextCompactionView,
  AgentExecutionBlockView,
  AgentReasoningView,
  AgentToolActivityView,
} from "./types";

export type AgentExecutionBlockProps = {
  block: AgentExecutionBlockView;
  entityBindings?: ChatEntityBindings;
};

function compactTokenCount(tokens: number | undefined) {
  if (tokens === undefined) return null;
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(tokens);
}

function ContextCompactionBlock({ compaction }: { compaction: AgentContextCompactionView }) {
  const before = compactTokenCount(compaction.tokensBefore);
  const after = compactTokenCount(compaction.estimatedTokensAfter);
  const tokenChange = before && after ? `${before} → ${after} tokens` : null;

  return (
    <details
      data-testid="agent-context-compaction-receipt"
      className="group w-full rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
    >
      <summary className="cursor-pointer select-none text-muted-foreground outline-none marker:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
        <span className="ml-1 font-medium text-foreground">已压缩较早的对话上下文</span>
        {tokenChange ? <span className="ml-2 text-xs tabular-nums">{tokenChange}</span> : null}
      </summary>
      <div
        data-testid="agent-context-compaction-summary"
        className="mt-3 whitespace-pre-wrap border-t border-border pt-3 leading-6 text-muted-foreground"
      >
        {compaction.summary}
      </div>
    </details>
  );
}

function ReasoningBlock({
  reasoning,
  entityBindings,
}: {
  reasoning: AgentReasoningView;
  entityBindings?: ChatEntityBindings;
}) {
  const streaming = reasoning.status === "streaming";
  return (
    <Collapsible
      data-slot="agent-reasoning"
      data-testid="agent-reasoning"
      className="my-1 min-w-0 w-full rounded-md border-l-2 border-border/80 bg-muted/30 py-1.5 pl-3 pr-2 text-sm text-muted-foreground"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-muted/55">
        {streaming ? <Spinner className="size-3 shrink-0" /> : null}
        <span>{streaming ? "正在思考" : "思考过程"}</span>
        <ChevronDown className="size-3 shrink-0 -rotate-90 text-muted-foreground opacity-0 transition group-data-[panel-open]:rotate-0 group-data-[panel-open]:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 px-1 pb-1 text-muted-foreground">
        {reasoning.markdown ? (
          <ChatMarkdown value={reasoning.markdown} tone="muted" {...entityBindings} />
        ) : (
          <span>等待模型输出思考内容</span>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolActivityBlock({ activity }: { activity: AgentToolActivityView }) {
  const statusLabel =
    activity.status === "failed" ? "出错" : activity.status === "running" ? "运行中" : "完成";
  const [summary, ...meta] = activity.summary.split(" · ");
  const summaryParts = summary?.split(/(「[^」]+」)/g).filter(Boolean) ?? [];

  return (
    <div
      data-testid="agent-tool-activity"
      data-activity-id={activity.id}
      className="my-0.5 flex min-w-0 w-full items-center gap-2 px-1 py-0.5 text-sm text-muted-foreground"
    >
      {activity.status === "running" ? (
        <Spinner
          className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400"
          role="presentation"
          aria-hidden="true"
        />
      ) : activity.status === "failed" ? (
        <TriangleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <CheckCircle2
          className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1 truncate">
        {summaryParts.map((part, index) =>
          part.startsWith("「") && part.endsWith("」") ? (
            <span
              key={`${part}-${index}`}
              data-slot="agent-tool-target"
              className="font-medium text-foreground"
            >
              {part}
            </span>
          ) : (
            part
          ),
        )}
        {meta.length > 0 ? (
          <span data-slot="agent-tool-meta" className="ml-1.5 text-xs text-muted-foreground/65">
            · {meta.join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="sr-only">{statusLabel}</span>
    </div>
  );
}

export function AgentPendingBlock({ label = "正在思考" }: { label?: string }) {
  return (
    <div
      data-testid="agent-running-placeholder"
      className="flex max-w-full items-center gap-2 rounded-md bg-muted/35 px-2.5 py-1.5 text-xs text-muted-foreground"
    >
      <Spinner className="size-3 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

export function AgentExecutionBlock({ block, entityBindings }: AgentExecutionBlockProps) {
  if (block.kind === "reasoning") {
    return <ReasoningBlock reasoning={block.reasoning} entityBindings={entityBindings} />;
  }
  if (block.kind === "tool-activity") {
    return <ToolActivityBlock activity={block.activity} />;
  }
  if (block.kind === "context-compaction") {
    return <ContextCompactionBlock compaction={block.compaction} />;
  }
  return <AgentPendingBlock label={block.pending.label} />;
}
