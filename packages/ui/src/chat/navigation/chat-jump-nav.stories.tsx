import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import { ChatJumpNav, type ChatJumpNavItem } from "./chat-jump-nav";

const typicalItems: ChatJumpNavItem[] = [
  { turnId: "turn-1", label: "帮我复核低温环境下的分区灌溉策略" },
  { turnId: "turn-2", label: "先读取相关 Understanding 和夜班联调记录" },
  { turnId: "turn-3", label: "比较三种可能原因并指出证据缺口" },
  { turnId: "turn-4", label: "把结论整理成可以长期维护的 Understanding" },
  { turnId: "turn-5", label: "最后给出下一轮复验计划" },
];

const manyItems: ChatJumpNavItem[] = Array.from({ length: 24 }, (_, index) => ({
  turnId: `turn-many-${index + 1}`,
  label:
    index % 4 === 0
      ? `第 ${index + 1} 条用户消息有一个非常长的标签，用来观察展开导航时的单行截断和可点击区域`
      : `第 ${index + 1} 条用户消息 · 继续复核观测结果`,
}));

function JumpNavSurface({
  items,
  height = "h-80",
  expanded = false,
}: {
  items: ChatJumpNavItem[];
  height?: string;
  expanded?: boolean;
}) {
  const [activeTurnId, setActiveTurnId] = useState<string | null>(items[1]?.turnId ?? null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    surfaceRef.current
      ?.querySelector<HTMLButtonElement>('[data-testid="agent-chat-jump-trigger"]')
      ?.focus();
  }, [expanded]);

  return (
    <div className="grid gap-3">
      <div ref={surfaceRef} className={`relative ${height} min-w-0 overflow-hidden bg-muted/15`}>
        <div className="mx-auto grid max-w-3xl gap-4 px-12 py-8 text-sm text-muted-foreground">
          {items.slice(0, 8).map((item) => (
            <p key={item.turnId}>{item.label}</p>
          ))}
        </div>
        <ChatJumpNav items={items} activeTurnId={activeTurnId} onJump={setActiveTurnId} />
      </div>
      <p className="text-xs text-muted-foreground">
        当前轮次：{activeTurnId ?? "无"}。Hover 右侧入口或使用 Tab 展开导航。
      </p>
    </div>
  );
}

function ChatJumpNavShowcase() {
  return (
    <StoryShowcase
      title="Message Jump Nav"
      description="验收长对话导航的出现阈值、折叠入口、Hover/Focus 展开、当前轮次和短视口滚动。"
    >
      <StoryCase
        title="出现阈值"
        description="少于 4 个对话轮次时不显示导航；达到阈值后出现右侧入口。"
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <JumpNavSurface items={typicalItems.slice(0, 3)} height="h-56" />
          <JumpNavSurface items={typicalItems.slice(0, 4)} height="h-56" />
        </div>
      </StoryCase>

      <StoryCase
        title="折叠、展开与跳转"
        description="折叠态以轻量位置轨道常驻；展开后点击条目立即更新当前位置。"
      >
        <JumpNavSurface items={typicalItems} expanded />
      </StoryCase>

      <StoryCase
        title="长列表、长标题与短视口"
        description="展开后在 280px 高度内滚动，长标签截断且保留完整 title。"
      >
        <JumpNavSurface items={manyItems} height="h-[280px]" />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: ChatJumpNav,
  parameters: {
    layout: "padded",
  },
  args: {
    items: typicalItems,
    activeTurnId: "turn-2",
    onJump: () => undefined,
  },
} satisfies Meta<typeof ChatJumpNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MessageJumpNavStory: Story = {
  name: "Message Jump Nav",
  render: () => <ChatJumpNavShowcase />,
};
