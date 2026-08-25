import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import {
  typicalCanvasDocument,
  typicalUnderstandingRefs,
} from "../../canvas/canvas-story-fixtures";
import { ReadOnlyCanvasSkeleton } from "../../canvas/readonly-canvas-card";
import { AgentCanvasView } from "./agent-canvas-view";
import type { AgentCanvasViewBlock } from "./types";

// 完成态：实时 hydration 的引用理解卡（含删除占位）随只读图一起出现。
const completedBlock: AgentCanvasViewBlock = {
  kind: "canvas-view",
  id: "card-canvas-view",
  title: "夜班灌溉知识结构",
  caption: "基于现有 Understanding 的分析视图，未保存。",
  document: typicalCanvasDocument,
  understandingRefs: typicalUnderstandingRefs,
};

// 标题兜底：output 冻结的 understandingTitles（实体删除 / 重命名时的可读标签）。
const titleFallbackBlock: AgentCanvasViewBlock = {
  kind: "canvas-view",
  id: "card-canvas-view-titles",
  title: "长标题：低温条件下的分区灌溉策略与阀门启动顺序",
  document: typicalCanvasDocument,
  understandingTitles: [...typicalUnderstandingRefs.values()].map((ref) => ({
    id: ref.id,
    title: ref.title ?? ref.id,
  })),
};

function CanvasViewShowcase() {
  return (
    <StoryShowcase
      title="canvas-view 分析视图"
      description="验收独立只读分析画布卡：完成态（含引用理解卡与删除占位）、标题兜底、窄容器与加载骨架。"
    >
      <StoryCase
        title="完成态"
        description="标题 + 说明 + 右上角全屏按钮；引用理解卡由消息层 hydration 提供全文。"
      >
        <AgentCanvasView block={completedBlock} />
      </StoryCase>
      <StoryCase
        title="标题兜底"
        description="无 caption，长标题截断；引用卡仅 output 冻结标题，没有实时 hydration。"
      >
        <AgentCanvasView block={titleFallbackBlock} />
      </StoryCase>
      <StoryCase title="窄容器" description="消息宽度受限于窄面板时，标题与工具栏不被撑破。">
        <div className="w-[360px] max-w-full">
          <AgentCanvasView block={completedBlock} />
        </div>
      </StoryCase>
      <StoryCase
        title="加载骨架"
        description="X6 懒加载 / 生成期间的占位：pulsing 卡片 + 连接线，示意结构正在成形。"
      >
        <div className="relative h-72">
          <ReadOnlyCanvasSkeleton />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: AgentCanvasView,
  args: {
    block: completedBlock,
  },
} satisfies Meta<typeof AgentCanvasView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanvasViewStory: Story = {
  name: "Canvas View",
  render: () => <CanvasViewShowcase />,
};
