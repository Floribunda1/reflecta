import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  FilePenLine,
  FileText,
  FolderTree,
  Globe2,
  Info,
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
import { memo, useDeferredValue, useEffect, useRef, useState } from "react";
import { cn } from "#lib/utils";
import { EASE_OUT_EXPO, ENTER_DURATION, FADE_UP_Y } from "#lib/motion";
import { useElapsed } from "#hooks/use-elapsed";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../../components/alert";
import { Button } from "../../components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import type { ChatEntityBindings } from "../entity";
import { ChatMarkdown } from "../markdown/chat-markdown";
import { elapsedBetween, toolIconKind, type AgentToolIconKind } from "./activity-presentation";
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
  /** 思考行完成时刻（下一块 createdAt 或正文起点），用于冻结「思考了 Xs」。 */
  endedAt?: string;
};

function compactTokenCount(tokens: number | undefined) {
  if (tokens === undefined) return null;
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(tokens);
}

const REASONING_SCROLL_END_THRESHOLD = 32;

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
              <AgentWorkingIndicator className="size-full text-muted-foreground" />
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
                  className="mx-auto my-0.5 size-3 text-muted-foreground"
                />
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </MotionConfig>
  );
}

export function AgentContextCompactionStatus({
  compaction,
}: {
  compaction?: AgentContextCompactionView;
}) {
  // 进行中计时（与 AgentPendingBlock 的「等待」占位同语义：小字 + 计时）。
  const elapsed = useElapsed(!compaction);
  if (!compaction) {
    return (
      <div
        data-testid="agent-context-compaction-progress"
        className="flex min-w-0 items-center gap-2 py-0.5 text-body font-medium text-muted-foreground"
        role="status"
      >
        <AgentWorkingIndicator
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span aria-hidden="true" className="truncate shimmer-text">
          正在压缩较早的对话上下文…
        </span>
        {elapsed !== "0.0s" ? (
          <span className="shrink-0 font-mono tabular-nums" role="timer">
            {elapsed}
          </span>
        ) : null}
      </div>
    );
  }

  const before = compactTokenCount(compaction.tokensBefore);
  const after = compactTokenCount(compaction.estimatedTokensAfter);
  const tokenChange = before && after ? `${before} → ${after} tokens` : null;

  return (
    <Collapsible
      data-testid="agent-context-compaction-receipt"
      className="group/compaction min-w-0 w-full text-body text-muted-foreground"
    >
      <CollapsibleTrigger
        data-testid="agent-context-compaction-trigger"
        className="group flex w-full cursor-pointer items-center gap-2 py-0.5 text-left outline-none transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      >
        <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium text-muted-foreground">已压缩较早的对话上下文</span>
        {tokenChange ? (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {tokenChange}
          </span>
        ) : null}
        <ChevronRight className="ml-auto size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-aria-expanded:hidden" />
        <ChevronDown className="ml-auto hidden size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-aria-expanded:block" />
      </CollapsibleTrigger>
      <CollapsibleContent
        data-testid="agent-context-compaction-summary"
        keepMounted
        className="collapse-grid ml-[7px] border-l border-border py-1 pl-[17px] pr-2"
      >
        <div className="whitespace-pre-wrap leading-6">{compaction.summary}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const ReasoningMarkdown = memo(
  function ReasoningMarkdown({
    markdown,
    streaming,
    entityBindings,
  }: {
    markdown: string;
    streaming: boolean;
    open: boolean;
    entityBindings?: ChatEntityBindings;
  }) {
    return (
      <ChatMarkdown
        value={markdown}
        tone="muted"
        streaming={streaming}
        animateStreaming={false}
        {...entityBindings}
      />
    );
  },
  (previous, next) => {
    // While closed (or while collapsing), keep the last rendered DOM: the
    // panel is hidden via CSS and only needs a re-render when re-opened.
    if (!next.open) return true;
    // Opening: render the latest markdown (it may be stale from being skipped).
    if (!previous.open) return false;
    return (
      previous.markdown === next.markdown &&
      previous.streaming === next.streaming &&
      previous.entityBindings === next.entityBindings
    );
  },
);

function ReasoningBlock({
  reasoning,
  entityBindings,
  endedAt,
}: {
  reasoning: AgentReasoningView;
  entityBindings?: ChatEntityBindings;
  endedAt?: string;
}) {
  const streaming = reasoning.status === "streaming";
  const [open, setOpen] = useState(false);
  const deferredMarkdown = useDeferredValue(reasoning.markdown);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  // 进行中从真实起点（缺 createdAt 则从挂载）秒表；完成时 useElapsed(false) 冻结现值。
  const liveElapsed = useElapsed(streaming ? (reasoning.createdAt ?? true) : false);
  const frozenLive = liveElapsed !== "0.0s" ? liveElapsed : null;
  const duration = streaming
    ? frozenLive
    : (frozenLive ?? elapsedBetween(reasoning.createdAt, endedAt));

  // 展开时重新开始跟随底部，并滚到最新内容。
  useEffect(() => {
    if (!open) return;
    stickToBottomRef.current = true;
    const frame = requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (!element) return;
      element.scrollTop = element.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // 流式输出新 token 时跟随底部；用户向上滚动后暂停跟随。
  useEffect(() => {
    if (!open || !stickToBottomRef.current) return;
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [open, deferredMarkdown]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    stickToBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight <=
      REASONING_SCROLL_END_THRESHOLD;
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-slot="agent-reasoning"
      data-testid="agent-reasoning"
      className="my-0.5 min-w-0 w-full text-body text-muted-foreground"
    >
      <CollapsibleTrigger
        className={cn(
          // DESIGN: 行级 hover 对齐 Beautiful UI（thinking-state header：w-fit pill + hover:bg-hover-2 + 100ms）。
          "group/row flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
          streaming && "font-medium text-foreground",
        )}
      >
        {streaming ? (
          <AgentWorkingIndicator className="size-3.5 text-muted-foreground" aria-hidden="true" />
        ) : (
          // DESIGN: hover 时 icon 淡出、chevron 淡入——收起显示 ChevronRight（→），展开显示 ChevronDown（↓）。
          <span
            className="group/icon relative flex size-4 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <span className="grid place-items-center transition-opacity duration-100 group-hover/row:opacity-0 group-aria-expanded:opacity-0">
              <MessageCircleDashed className="size-3 text-muted-foreground" />
            </span>
            {open ? (
              <ChevronDown className="absolute size-3 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-aria-expanded:opacity-100" />
            ) : (
              <ChevronRight className="absolute size-3 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/row:opacity-100" />
            )}
          </span>
        )}
        {/* DESIGN: 折叠摘要只用状态+耗时（进行中「正在思考... 3.2s」，完成「思考了 3.2s」），
            不展示推理正文摘要（避免剧透/误导）；展开态才看全文。 */}
        <span className="flex min-w-0 flex-1 items-center gap-2 text-body font-medium">
          {streaming ? (
            <>
              <span aria-hidden="true" className="shimmer-text">
                正在思考...
              </span>
              {duration ? (
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {duration}
                </span>
              ) : null}
            </>
          ) : duration ? (
            <>
              思考了 <span className="font-mono tabular-nums">{duration}</span>
            </>
          ) : (
            "思考过程"
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent data-testid="agent-reasoning-detail" className="text-muted-foreground">
        {/* 展开动画：高度 0→auto + 淡入（motion）。收起即卸载（无 keepMounted），
            释放流式推理的渲染 DOM —— 性能契约，见 reasoning-stream-benchmark。 */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: ENTER_DURATION, ease: EASE_OUT_EXPO }}
          className="overflow-hidden"
        >
          <div className="pb-1 pl-[17px] pr-2">
            {/* DESIGN: 与上方折叠内容列同列对齐（trigger 首图标宽 16px+1px），pl-[17px] 为组内统一缩进。 */}
            {/* 左侧连接线随容器高度生长（motion height 动画时渐变），timeline 感 */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              data-testid="agent-reasoning-scroll"
              className="max-h-96 overflow-y-auto border-l border-border pl-3"
            >
              <ReasoningMarkdown
                markdown={deferredMarkdown}
                streaming={streaming}
                open={open}
                entityBindings={entityBindings}
              />
            </div>
          </div>
        </motion.div>
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
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-testid="agent-tool-activity"
      data-activity-id={activity.id}
      className="min-w-0 w-full text-body text-muted-foreground"
    >
      <CollapsibleTrigger
        disabled={!hasContent}
        className={cn(
          // DESIGN: 行级 hover 对齐 Beautiful UI（tool-chips：w-fit pill + hover:bg-hover-2 + 100ms）。
          "group/row flex w-full items-center gap-2 rounded-md px-1 py-1 text-left outline-none transition-colors duration-100 enabled:cursor-pointer enabled:hover:bg-muted enabled:hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
          activity.status === "running" && "font-medium text-foreground",
        )}
      >
        {/* hover/展开时图标位淡出为折叠 chevron（Beautiful UI Tool Chips 做法） */}
        <span
          className="group/icon relative flex size-4 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <span className="grid place-items-center transition-opacity duration-100 group-hover/row:opacity-0 group-aria-expanded:opacity-0">
            <ToolStatusIcon status={activity.status} iconKind={iconKind} />
          </span>
          {hasContent ? (
            // DESIGN: hover 时 icon 淡出、chevron 淡入——收起 ChevronRight（→），展开 ChevronDown（↓）。
            open ? (
              <ChevronDown className="absolute size-3 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-aria-expanded:opacity-100" />
            ) : (
              <ChevronRight className="absolute size-3 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/row:opacity-100" />
            )
          ) : null}
        </span>
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
            <span data-slot="agent-tool-meta" className="ml-1.5 text-xs text-muted-foreground">
              · {meta.join(" · ")}
            </span>
          ) : null}
        </span>
        <span className="sr-only">{statusLabel}</span>
      </CollapsibleTrigger>
      {hasContent ? (
        <CollapsibleContent
          data-testid="agent-tool-detail"
          keepMounted
          className="collapse-grid ml-[7px] border-l border-border py-1 pl-[17px] pr-2 text-muted-foreground"
        >
          <div className="grid gap-2">
            {activity.items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={false}
                animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: FADE_UP_Y }}
                transition={{
                  duration: ENTER_DURATION,
                  ease: EASE_OUT_EXPO,
                  delay: open ? Math.min(index, 6) * 0.06 : 0,
                }}
                className="grid gap-1"
              >
                {activity.items.length > 1 ? (
                  <div className="px-1 text-xs font-medium text-muted-foreground">{item.label}</div>
                ) : null}
                {hasToolDetails(item.details) ? <ToolDetails details={item.details!} /> : null}
                {item.error ? (
                  <div className="break-words px-1 text-destructive">{item.error}</div>
                ) : null}
              </motion.div>
            ))}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

export function AgentPendingBlock({ label = "等待中..." }: { label?: string }) {
  const elapsed = useElapsed(true);
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        data-testid="agent-running-placeholder"
        initial={{ opacity: 0, y: FADE_UP_Y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ENTER_DURATION, ease: EASE_OUT_EXPO }}
        className="mt-1 flex w-fit max-w-full items-center gap-2 text-body font-medium text-muted-foreground"
      >
        <AgentWorkingIndicator
          variant="drive"
          className="size-3 text-muted-foreground"
          role="status"
          aria-label="执行中"
        />
        <span aria-hidden="true" className="shimmer-text font-medium">
          {label}
        </span>
        {elapsed !== "0.0s" ? (
          <span className="shrink-0 font-mono tabular-nums" role="timer">
            {elapsed}
          </span>
        ) : null}
      </motion.div>
    </MotionConfig>
  );
}

export function AgentStoppedStatus() {
  return (
    <div
      data-testid="agent-stopped-state"
      className="flex min-w-0 items-center gap-2 px-3 py-1 text-body text-muted-foreground select-none"
    >
      <Info className="size-3 shrink-0" aria-hidden="true" />
      <span>已停止</span>
    </div>
  );
}

export function AgentFailureStatus({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <div data-testid="agent-error-banner" className="w-full pt-2">
      <Alert variant="destructive" className="max-w-none">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>回复失败</AlertTitle>
        <AlertDescription className="break-words leading-5">{error ?? "未知错误"}</AlertDescription>
        {onRetry ? (
          <AlertAction>
            <Button
              data-testid="agent-retry-button"
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
            >
              重试
            </Button>
          </AlertAction>
        ) : null}
      </Alert>
    </div>
  );
}

export function AgentExecutionBlock({ block, entityBindings, endedAt }: AgentExecutionBlockProps) {
  if (block.kind === "reasoning") {
    return (
      <ReasoningBlock
        reasoning={block.reasoning}
        entityBindings={entityBindings}
        endedAt={endedAt}
      />
    );
  }
  if (block.kind === "tool-activity") {
    return <ToolActivityBlock activity={block.activity} />;
  }
  if (block.kind === "context-compaction") {
    return <AgentContextCompactionStatus compaction={block.compaction} />;
  }
  return <AgentPendingBlock label={block.pending.label} />;
}
