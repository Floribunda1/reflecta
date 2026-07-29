import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import {
  ChatThreadSidebar,
  type ChatThreadAction,
  type ChatThreadGroupView,
} from "./chat-thread-sidebar";

const typicalGroups: ChatThreadGroupView[] = [
  {
    id: "today",
    label: "今天",
    threads: [
      { id: "thread-active", title: "复核分区灌溉策略", hasMessages: true },
      {
        id: "thread-running",
        title: "整理夜班联调记录",
        running: true,
        hasMessages: true,
      },
      {
        id: "thread-title",
        title: "新对话",
        titleGenerating: true,
        hasMessages: false,
      },
    ],
  },
  {
    id: "week",
    label: "最近 7 天",
    threads: [
      { id: "thread-pressure", title: "比较主管压力异常的三种解释" },
      { id: "thread-sensors", title: "传感器漂移复核" },
    ],
  },
  {
    id: "older",
    label: "更早",
    threads: [{ id: "thread-archive", title: "设施工程知识整理" }],
  },
];

const manyGroups: ChatThreadGroupView[] = [
  {
    id: "today",
    label: "今天",
    threads: Array.from({ length: 18 }, (_, index) => ({
      id: `thread-many-${index + 1}`,
      title:
        index % 3 === 0
          ? `第 ${index + 1} 个对话使用非常长的标题来检查固定宽度下的单行截断和状态图标`
          : `第 ${index + 1} 个现场复核对话`,
      running: index === 2,
      titleGenerating: index === 5,
    })),
  },
  {
    id: "month",
    label: "最近 30 天",
    threads: Array.from({ length: 12 }, (_, index) => ({
      id: `thread-older-${index + 1}`,
      title: `历史对话 ${index + 1} · 灌溉控制复盘`,
    })),
  },
];

function SidebarDemo({
  groups = typicalGroups,
  pending,
}: {
  groups?: ChatThreadGroupView[];
  pending?: boolean;
}) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>("thread-active");
  const [lastAction, setLastAction] = useState("尚未执行菜单操作");

  const recordAction = (threadId: string, action: ChatThreadAction) => {
    setLastAction(`${action}：${threadId}`);
  };

  return (
    <div className="grid gap-3">
      <div className="flex h-[620px] w-[280px] max-w-full border-r bg-card/95">
        <ChatThreadSidebar
          groups={groups}
          pending={pending}
          activeThreadId={activeThreadId}
          onSelect={setActiveThreadId}
          onCreate={() => setLastAction("create")}
          onCollapse={() => setLastAction("collapse")}
          onAction={recordAction}
        />
      </div>
      <p className="text-xs text-muted-foreground">{lastAction}</p>
    </div>
  );
}

function ThreadSidebarShowcase() {
  return (
    <StoryShowcase
      title="Thread Sidebar"
      description="验收对话分组、当前态、并发反馈、菜单操作、空状态和固定高度滚动。"
    >
      <StoryCase
        title="分组与并发状态"
        description="当前对话、运行中和生成标题可同时出现在不同项目；点击可切换当前态。"
      >
        <SidebarDemo />
      </StoryCase>

      <StoryCase
        title="对话操作"
        description="右键打开生产菜单，运行中与生成标题项目显示相应 disabled 状态。"
      >
        <SidebarDemo />
      </StoryCase>

      <StoryCase title="加载与空状态">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">加载中</span>
            <SidebarDemo groups={[]} pending />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">空列表</span>
            <SidebarDemo groups={[]} />
          </div>
        </div>
      </StoryCase>

      <StoryCase
        title="长标题、大量对话与滚动"
        description="280px × 620px 容器内保持标题截断、状态图标和垂直滚动。"
      >
        <SidebarDemo groups={manyGroups} />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: ChatThreadSidebar,
  parameters: {
    layout: "padded",
  },
  args: {
    groups: typicalGroups,
    activeThreadId: "thread-active",
    onSelect: () => undefined,
    onCreate: () => undefined,
    onCollapse: () => undefined,
    onAction: () => undefined,
  },
} satisfies Meta<typeof ChatThreadSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreadSidebarStory: Story = {
  name: "Thread Sidebar",
  render: () => <ThreadSidebarShowcase />,
};
