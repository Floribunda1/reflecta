import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import { useState } from "react";
import { useAutoFrame } from "../../../.storybook/use-auto-frame";
import {
  AgentContextCompactionStatus,
  AgentExecutionBlock,
  AgentFailureStatus,
  AgentStoppedStatus,
} from "./agent-execution-block";
import { AgentWorkingIndicator } from "./agent-working-indicator";
import type {
  AgentContextCompactionView,
  AgentExecutionBlockView,
  AgentToolActivityView,
} from "./types";

/**
 * Agent Execution Block 全分支展示（Agent / Execution）
 *
 * 覆盖：Reasoning（done / streaming）、ToolActivity（running / done / failed）、
 * ContextCompaction（进度 / 回执）、Pending、Stopped、Failure。
 * 直接使用 execution/types.ts 的视图类型构造，不经过 renderer 转换层。
 */

// storybook 相对时间：不用写死历史时间——进入时作为基准，展示「刚刚开始/几秒前」。
const storyTime = (offsetMs = 0) => new Date(Date.now() - offsetMs).toISOString();

const reasoningDone: AgentExecutionBlockView = {
  kind: "reasoning",
  reasoning: {
    id: "reasoning-done-1",
    status: "done",
    markdown: "先读取相关记录和本地配置，再核对现有知识与现场数据，确认灌溉窗口没有冲突。",
    createdAt: storyTime(5_000),
  },
};

const reasoningLongDone: AgentExecutionBlockView = {
  kind: "reasoning",
  reasoning: {
    id: "reasoning-done-2",
    status: "done",
    createdAt: storyTime(5_000),
    markdown: [
      "## 观察",
      "温室外部风速维持在每秒十八米，西侧保温帘出现间歇抖动。",
      "",
      "## 判定",
      "本轮不追求瞬时恢复到目标值，而是观察三十分钟移动平均是否回到安全区间。",
      "",
      "## 遗留",
      "东侧支路在低温时仍偶发两到三秒的通信空窗，下一轮计划增加本地缓存计数。",
    ].join("\n\n"),
  },
};

const reasoningEndedAt = storyTime(0);

function StreamingReasoning() {
  const frame = useAutoFrame(4);
  // 第一次进入（组件挂载）时作为思考起点，计时从 0 开始增长。
  const [startedAt] = useState(() => new Date().toISOString());
  const markdown = [
    "正在汇总",
    "正在汇总 Tool 的执行结果，",
    "正在汇总 Tool 的执行结果，并检查失败步骤。",
    "正在汇总 Tool 的执行结果，并检查失败步骤。已有信息足够，继续检查知识库与关联关系。",
  ][frame];

  return (
    <AgentExecutionBlock
      block={{
        kind: "reasoning",
        reasoning: {
          id: "reasoning-stream-1",
          status: "streaming",
          markdown,
          createdAt: startedAt,
        },
      }}
    />
  );
}

function activity(
  id: string,
  status: AgentToolActivityView["status"],
  summary: string,
  items: AgentToolActivityView["items"],
): AgentToolActivityView {
  return { id, status, summary, items };
}

const toolRunning: AgentExecutionBlockView = {
  kind: "tool-activity",
  activity: activity("tool-running-1", "running", "正在读取 irrigation-zones.ts", []),
};

const toolDone: AgentExecutionBlockView = {
  kind: "tool-activity",
  activity: activity("tool-done-1", "done", "读取 irrigation-zones.ts · 2 个文件", [
    {
      id: "row-1",
      label: "irrigation-zones.ts",
      details: {
        rows: [
          { id: "d1", label: "路径", title: "apps/control/src/irrigation-zones.ts" },
          { id: "d2", label: "行数", title: "120 行" },
        ],
      },
    },
    {
      id: "row-2",
      label: "legacy-observation.md",
      details: {
        badges: ["experience", "已复核"],
        rows: [{ id: "d3", title: "夜班联调记录（复核版）" }],
      },
    },
  ]),
};

const toolFailed: AgentExecutionBlockView = {
  kind: "tool-activity",
  activity: activity("tool-failed-1", "failed", "执行 bash · 遥测校验超时", [
    {
      id: "err-1",
      label: "verify:telemetry",
      error:
        "遥测校验在等待 west-03 支路的稳定压力时超时。最近三次采样都低于最低阈值，控制程序已经停止后续阀门动作并保留现场状态。",
    },
  ]),
};

const compactionReceipt: AgentContextCompactionView = {
  id: "compaction-1",
  summary:
    "较早的 6 轮对话中，关于传感器标定与阀门启动顺序的讨论已被压缩为结论摘要；原始记录保留在归档中，可随时展开查看。",
  tokensBefore: 42_000,
  estimatedTokensAfter: 18_500,
};

const allBlocks: AgentExecutionBlockView[] = [
  { kind: "pending", pending: { id: "pending-1" } },
  { kind: "pending", pending: { id: "pending-2", label: "读取上下文" } },
  reasoningDone,
  reasoningLongDone,
  toolRunning,
  toolDone,
  toolFailed,
];

export default {
  title: "Agent/基本组件",
  parameters: {
    layout: "fullscreen",
    options: { showPanel: false },
  },
};

export function Overview() {
  return (
    <StoryShowcase
      title="Execution"
      description="Agent 执行过程中的全部状态块：思考、工具活动、上下文压缩、占位与失败态。用于验证 execution 组件的样式与状态流转。"
    >
      <StoryCase title="思考（Reasoning）">
        <div className="grid max-w-4xl gap-1">
          <AgentExecutionBlock block={reasoningDone} endedAt={reasoningEndedAt} />
          <AgentExecutionBlock block={reasoningLongDone} endedAt={reasoningEndedAt} />
          <StreamingReasoning />
        </div>
      </StoryCase>

      <StoryCase title="工具活动（ToolActivity）">
        <div className="grid max-w-4xl gap-1">
          <AgentExecutionBlock block={toolRunning} />
          <AgentExecutionBlock block={toolDone} />
          <AgentExecutionBlock block={toolFailed} />
        </div>
      </StoryCase>

      <StoryCase title="上下文压缩（ContextCompaction）">
        <div className="grid max-w-4xl gap-1">
          <AgentContextCompactionStatus />
          <AgentContextCompactionStatus compaction={compactionReceipt} />
        </div>
      </StoryCase>

      <StoryCase title="占位与状态">
        <div className="grid max-w-4xl gap-1">
          {allBlocks.map((block) => (
            <AgentExecutionBlock
              key={JSON.stringify(block)}
              block={block}
              endedAt={block.kind === "reasoning" ? reasoningEndedAt : undefined}
            />
          ))}
          <AgentStoppedStatus />
        </div>
      </StoryCase>

      <StoryCase title="失败态（Failure）">
        <div className="grid max-w-4xl gap-2">
          <AgentFailureStatus error="最终答案生成失败：模型输出被截断，请重试。" />
          <AgentFailureStatus
            error="知识库写入冲突：目标 Understanding 已被其他会话修改。"
            onRetry={() => undefined}
          />
        </div>
      </StoryCase>

      <StoryCase
        title="Working Indicator 变体"
        description="grid / drive / dots / orbit 在明暗背景下是否清晰、节奏是否一致。"
      >
        <div className="grid max-w-4xl gap-4">
          <div className="grid grid-cols-2 gap-6 p-4 md:grid-cols-4">
            {(["grid", "drive", "dots", "orbit"] as const).map((variant) => (
              <div key={variant} className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">{variant}</span>
                <AgentWorkingIndicator variant={variant} className="size-4" />
              </div>
            ))}
          </div>
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}
