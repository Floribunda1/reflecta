import { ChevronDown, ChevronRight, Clock, Zap } from "lucide-react";
import { motion, MotionConfig } from "motion/react";
import { Fragment, useState } from "react";
import { EASE_OUT_EXPO, ENTER_DURATION, FADE_UP_Y } from "#lib/motion";
import { useElapsed } from "#hooks/use-elapsed";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/collapsible";
import type { ChatEntityBindings } from "../entity";
import {
  activityGroupPresentation,
  activityStartedAt,
  type AgentActivityGroupPresentation,
} from "./activity-presentation";
import { AgentExecutionBlock } from "./agent-execution-block";
import { AgentWorkingIndicator } from "./agent-working-indicator";
import type { AgentActivityBlockView } from "./types";

function MonoNumber({ children }: { children: string | number }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

function ActivityGroupSummary({
  presentation,
  runningElapsed,
}: {
  presentation: AgentActivityGroupPresentation;
  runningElapsed: string | null;
}) {
  if (presentation.running) {
    // DESIGN: 组概览 = 状态（X中，无省略号）+ 步数 + 耗时；数字均等宽。
    // 进行时细节（文案省略号/三点动画）由 thinking 行承载，避免回声。
    // 整行 shimmer（状态/分隔点/步数/耗时），间距由容器 flex gap 提供，
    // 不依赖文本里的空格——flex item 内的行首尾空格会被 white-space 折叠掉。
    return (
      <>
        <span className="shimmer-text">{presentation.summary}</span>
        <span aria-hidden="true" className="shimmer-text">
          ·
        </span>
        <span className="shimmer-text">
          共 <MonoNumber>{presentation.stepCount}</MonoNumber> 步
        </span>
        {runningElapsed ? (
          // 时钟图标不能进 shimmer span：shimmer-text 的 color: transparent 会让
          // lucide 的 currentColor 描边隐形；图标保持 muted 色，仅时间数字 shimmer。
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
            <span className="shimmer-text" role="timer">
              <MonoNumber>{runningElapsed}</MonoNumber>
            </span>
          </span>
        ) : null}
      </>
    );
  }
  const parts = [];
  if (presentation.hasReasoning) {
    parts.push(
      presentation.elapsed ? (
        <span key="think">
          思考了 <MonoNumber>{presentation.elapsed}</MonoNumber>
        </span>
      ) : (
        <span key="think">完成思考</span>
      ),
    );
  }
  if (presentation.toolCount > 0) {
    parts.push(
      <span key="tools">
        运行了 <MonoNumber>{presentation.toolCount}</MonoNumber> 个工具
      </span>,
    );
  }
  if (parts.length === 0) return "已完成";
  return parts.map((part, index) => (
    <Fragment key={part.key}>
      {index > 0 ? "，" : null}
      {part}
    </Fragment>
  ));
}

export type AgentActivityGroupProps = {
  blocks: readonly AgentActivityBlockView[];
  active?: boolean;
  endedAt?: string;
  defaultExpanded?: boolean;
  entityBindings?: ChatEntityBindings;
};

export function AgentActivityGroup({
  blocks,
  active = false,
  endedAt,
  defaultExpanded = false,
  entityBindings,
}: AgentActivityGroupProps) {
  const presentation = activityGroupPresentation(blocks, active, endedAt);
  const [manualOpen, setManualOpen] = useState(defaultExpanded);
  const liveElapsed = useElapsed(
    presentation.running ? (activityStartedAt(blocks) ?? true) : false,
  );
  const runningElapsed = presentation.running && liveElapsed !== "0.0s" ? liveElapsed : null;
  if (presentation.stepCount === 0) return null;

  // 进行中保持展开（可见活动推进），完成由用户控制（默认收成一行摘要）
  const open = presentation.running ? true : manualOpen;

  return (
    <MotionConfig reducedMotion="user">
      <Collapsible
        open={open}
        onOpenChange={setManualOpen}
        data-testid="agent-activity-group"
        data-state={presentation.running ? "working" : open ? "open" : "closed"}
        className="group/activity my-0.5 min-w-0 w-full"
      >
        <CollapsibleTrigger
          data-testid="agent-activity-group-trigger"
          // DESIGN: pill hover（w-fit 内容宽）；Zap 图标表「执行动作」，running 换三点指示器；
          // chevron 常显在文本右侧（收起 → / 展开 ↓），让可点击性一眼可见。
          className="group/row flex w-fit cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-body text-muted-foreground outline-none transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
            {presentation.running ? (
              <AgentWorkingIndicator className="size-3.5 text-muted-foreground" />
            ) : (
              <Zap className="size-3.5 text-muted-foreground" />
            )}
          </span>
          {/* DESIGN: summary 14px font-medium；运行中整行 shimmer，耗时在外侧等宽数字（与思考行一致）。 */}
          <span
            className={`flex min-w-0 items-center text-body font-medium ${
              presentation.running ? "gap-1.5" : "gap-0"
            }`}
          >
            <ActivityGroupSummary presentation={presentation} runningElapsed={runningElapsed} />
          </span>
          {presentation.errorCount > 0 ? (
            <span className="shrink-0 text-xs text-destructive">
              <MonoNumber>{presentation.errorCount}</MonoNumber> 个错误
            </span>
          ) : null}
          {open ? (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted className="collapse-grid">
          {/* DESIGN: 折叠内容竖线起始 ml-[13px] 与 trigger 行首元素视觉中线对齐；取整 ml-3(12px) 会可见偏移 1px。 */}
          <div className="ml-[13px] min-w-0 border-l-2 border-border py-0.5 pl-4 pr-2">
            {blocks.map((block, index) => {
              const next = blocks[index + 1];
              const blockEndedAt = next
                ? next.kind === "reasoning"
                  ? next.reasoning.createdAt
                  : next.activity.createdAt
                : endedAt;
              return (
                <motion.div
                  key={block.kind === "reasoning" ? block.reasoning.id : block.activity.id}
                  initial={{ opacity: 0, y: FADE_UP_Y }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: ENTER_DURATION,
                    ease: EASE_OUT_EXPO,
                    delay: Math.min(index, 8) * 0.04,
                  }}
                  className="min-w-0"
                >
                  <AgentExecutionBlock
                    block={block}
                    entityBindings={entityBindings}
                    endedAt={blockEndedAt}
                  />
                </motion.div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </MotionConfig>
  );
}
