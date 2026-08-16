import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { UnderstandingCard, type UnderstandingCardView } from "./understanding-card";

const understanding: UnderstandingCardView = {
  id: "understanding-irrigation",
  title: "低温环境下的分区灌溉策略",
  body: "不同种植槽根据 **基质含水率**、回水温度和主管压力获得独立灌溉窗口。",
  updatedLabel: "12 分钟前",
  contextCount: 4,
  mentionCount: 7,
  domainNames: ["工作", "温室工程"],
};

const emptyUnderstanding: UnderstandingCardView = {
  ...understanding,
  id: "understanding-empty",
  title: "尚未补充正文的理解",
  body: "",
  updatedLabel: "刚刚",
  contextCount: 0,
  mentionCount: 0,
  domainNames: [],
};

const longUnderstanding: UnderstandingCardView = {
  ...understanding,
  id: "understanding-long",
  title: "这是一个非常长的 Understanding 标题，用来观察标题与更新时间同时存在时是否正确截断",
  body: "这段 Markdown 摘要包含 **强调**、[来源链接](https://example.com) 和大量中英文内容，用来观察网格卡片宽度下的两行截断。".repeat(
    8,
  ),
  updatedLabel: "大约 1 年前",
  contextCount: 128,
  mentionCount: 256,
  domainNames: ["工作", "前端", "后端", "AI"],
};

function CardDemo({
  item = understanding,
  selected = false,
  canChat = true,
}: {
  item?: UnderstandingCardView;
  selected?: boolean;
  canChat?: boolean;
}) {
  const [currentSelected, setCurrentSelected] = useState(selected);
  const [lastAction, setLastAction] = useState("右键可以查看项目操作");
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[item, item, item].map((entry, index) => (
        <UnderstandingCard
          key={index}
          understanding={entry}
          selected={currentSelected && index === 0}
          canChat={canChat}
          onSelect={() => setCurrentSelected(true)}
          onAction={(action) => setLastAction(`${action.type}：${action.understanding.title}`)}
        />
      ))}
      <p className="col-span-full text-xs text-muted-foreground">{lastAction}</p>
    </div>
  );
}

function UnderstandingCardShowcase() {
  return (
    <StoryShowcase
      title="Understanding Card"
      description="dashboard 卡片网格中的理解卡片：标题 + 两行摘要 + 领域/时间/上下文元数据。"
    >
      <StoryCase
        title="常规卡片"
        description="标题、摘要、领域标签与计数；点击可选中（bg-muted 高亮）。"
      >
        <CardDemo />
      </StoryCase>

      <StoryCase title="空理解与多领域">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">空理解</span>
            <CardDemo item={emptyUnderstanding} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">多领域截断</span>
            <CardDemo item={longUnderstanding} />
          </div>
        </div>
      </StoryCase>

      <StoryCase title="无 AI 对话能力" description="canChat=false 时右键菜单只保留删除。">
        <CardDemo canChat={false} />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/基本组件",
  component: UnderstandingCard,
  parameters: {
    layout: "padded",
  },
  args: {
    understanding,
    onSelect: () => undefined,
    onAction: () => undefined,
  },
} satisfies Meta<typeof UnderstandingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderstandingCardStory: Story = {
  name: "Understanding Card",
  render: () => <UnderstandingCardShowcase />,
};
