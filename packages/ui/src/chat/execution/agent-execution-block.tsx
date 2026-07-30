import {
  ArrowUpRight,
  ChevronRight,
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
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { cn } from "#lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import type { ChatEntityBindings } from "../entity";
import { ChatMarkdown } from "../markdown/chat-markdown";
import { reasoningSummary, toolIconKind, type AgentToolIconKind } from "./activity-presentation";
import { AgentWorkingIndicator } from "./agent-working-indicator";
import { hasToolDetails, ToolDetails } from "./tool-details";
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

function ToolStatusIcon({
  status,
  iconKind,
}: {
  status: AgentToolActivityView["status"];
  iconKind: AgentToolIconKind;
}) {
  const ToolIcon = TOOL_ICONS[iconKind];
  return (
    <MotionConfig reducedMotion="user">
      <span className="relative size-4 shrink-0" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          {status === "running" ? (
            <motion.span
              key="running"
              data-slot="agent-tool-loading"
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.65 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.45, filter: "blur(2px)" }}
              transition={{ duration: 0.2 }}
            >
              <AgentWorkingIndicator className="size-full text-foreground/65" />
            </motion.span>
          ) : (
            <motion.span
              key={status}
              className="absolute inset-0"
              initial={{ opacity: 0, rotate: -35, scale: 0.55 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
            >
              {status === "failed" ? (
                <XCircle className="mx-auto my-0.5 size-3 text-destructive" />
              ) : (
                <ToolIcon
                  data-slot="agent-tool-icon"
                  data-tool-icon={iconKind}
                  className="mx-auto my-0.5 size-3 text-muted-foreground/70"
                />
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </MotionConfig>
  );
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
  const summary = reasoningSummary(reasoning.markdown);
  return (
    <Collapsible
      data-slot="agent-reasoning"
      data-testid="agent-reasoning"
      className="my-0.5 min-w-0 w-full text-[13px] text-foreground/75"
    >
      <CollapsibleTrigger
        className={cn(
          "group flex w-full cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-left hover:text-foreground",
          streaming && "font-medium text-foreground/85",
        )}
      >
        {streaming ? (
          <AgentWorkingIndicator className="text-foreground/65" aria-hidden="true" />
        ) : (
          <span className="flex size-4 shrink-0 items-center justify-center">
            <MessageCircleDashed className="size-3 text-muted-foreground" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        {!streaming ? (
          <ArrowUpRight className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent
        data-testid="agent-reasoning-detail"
        className="ml-[7px] mt-1 border-l border-border/60 py-1 pl-[17px] pr-2 text-muted-foreground"
      >
        {reasoning.markdown ? (
          <ChatMarkdown
            value={reasoning.markdown}
            tone="muted"
            streaming={streaming}
            {...entityBindings}
          />
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
  const [summary, ...meta] = activity.summary.split(" · ");
  const summaryParts = summary?.split(/(「[^」]+」)/g).filter(Boolean) ?? [];
  const hasContent = activity.items.some(
    (item) => hasToolDetails(item.details) || Boolean(item.error),
  );

  return (
    <Collapsible
      data-testid="agent-tool-activity"
      data-activity-id={activity.id}
      className="min-w-0 w-full text-[13px] text-muted-foreground/70"
    >
      <CollapsibleTrigger
        disabled={!hasContent}
        className={cn(
          "group flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left outline-none enabled:cursor-pointer enabled:hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/40",
          activity.status === "running" && "font-medium text-foreground/85",
        )}
      >
        <ToolStatusIcon status={activity.status} iconKind={iconKind} />
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
        {hasContent ? (
          <ChevronRight className="size-3 shrink-0 opacity-0 transition group-data-[panel-open]:rotate-90 group-data-[panel-open]:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100" />
        ) : null}
        <span className="sr-only">{statusLabel}</span>
      </CollapsibleTrigger>
      {hasContent ? (
        <CollapsibleContent
          data-testid="agent-tool-detail"
          className="ml-[7px] border-l border-border/60 py-1 pl-[17px] pr-2 text-muted-foreground"
        >
          <div className="grid gap-2">
            {activity.items.map((item) => (
              <div key={item.id} className="grid gap-1">
                {activity.items.length > 1 ? (
                  <div className="px-1 text-xs font-medium text-foreground/70">{item.label}</div>
                ) : null}
                {hasToolDetails(item.details) ? <ToolDetails details={item.details!} /> : null}
                {item.error ? (
                  <div className="break-words px-1 text-destructive">{item.error}</div>
                ) : null}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

export function AgentPendingBlock({ label = "正在思考" }: { label?: string }) {
  return (
    <div
      data-testid="agent-running-placeholder"
      className="mt-1 flex w-fit max-w-full items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground"
    >
      <AgentWorkingIndicator
        className="size-4 text-foreground/60"
        role="status"
        aria-label="执行中"
      />
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
