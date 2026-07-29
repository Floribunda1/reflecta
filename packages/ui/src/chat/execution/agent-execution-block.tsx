import {
  ArrowUpRight,
  FilePenLine,
  FileText,
  FolderTree,
  Globe2,
  Lightbulb,
  MessageCircleDashed,
  Network,
  NotebookText,
  Paperclip,
  Pencil,
  Search,
  Terminal,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import { Spinner } from "../../components/spinner";
import type { ChatEntityBindings } from "../entity";
import { ChatMarkdown } from "../markdown/chat-markdown";
import { reasoningSummary, toolIconKind, type AgentToolIconKind } from "./activity-presentation";
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

const TOOL_ICONS: Record<AgentToolIconKind, LucideIcon> = {
  attachment: Paperclip,
  command: Terminal,
  context: NotebookText,
  domain: FolderTree,
  edit: Pencil,
  file: FileText,
  graph: Network,
  search: Search,
  understanding: Lightbulb,
  web: Globe2,
  write: FilePenLine,
  other: Wrench,
};

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
  const summary = reasoningSummary(reasoning.markdown);
  return (
    <Collapsible
      data-slot="agent-reasoning"
      data-testid="agent-reasoning"
      className="my-0.5 min-w-0 w-full text-[13px] text-foreground/75"
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-left hover:text-foreground">
        {streaming ? (
          <Spinner
            className="size-3 shrink-0 text-sky-600 dark:text-sky-400"
            role="presentation"
            aria-hidden="true"
          />
        ) : (
          <MessageCircleDashed
            className="size-3 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span className="min-w-0 flex-1 truncate">{streaming ? "正在思考" : summary}</span>
        {!streaming ? (
          <ArrowUpRight className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent
        data-testid="agent-reasoning-detail"
        className="ml-[7px] mt-1 border-l border-border/60 py-1 pl-[17px] pr-2 text-muted-foreground"
      >
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
  const iconKind = toolIconKind(activity);
  const ToolIcon = TOOL_ICONS[iconKind];
  const [summary, ...meta] = activity.summary.split(" · ");
  const summaryParts = summary?.split(/(「[^」]+」)/g).filter(Boolean) ?? [];

  return (
    <div
      data-testid="agent-tool-activity"
      data-activity-id={activity.id}
      className="flex min-w-0 w-full items-center gap-2 px-1 py-1 text-[13px] text-muted-foreground/70"
    >
      {activity.status === "running" ? (
        <Spinner
          className="size-3 shrink-0 text-sky-600 dark:text-sky-400"
          role="presentation"
          aria-hidden="true"
        />
      ) : activity.status === "failed" ? (
        <XCircle className="size-3 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <ToolIcon
          data-slot="agent-tool-icon"
          data-tool-icon={iconKind}
          className="size-3 shrink-0 text-muted-foreground/70"
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1 truncate">
        {summaryParts.map((part, index) =>
          part.startsWith("「") && part.endsWith("」") ? (
            <span
              key={`${part}-${index}`}
              data-slot="agent-tool-target"
              className="font-medium text-foreground/75"
            >
              {part}
            </span>
          ) : (
            part
          ),
        )}
        {meta.length > 0 ? (
          <span data-slot="agent-tool-meta" className="ml-1.5 text-xs text-muted-foreground/50">
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
