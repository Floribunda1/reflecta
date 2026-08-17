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
  body: `# 分区灌溉

不同种植槽根据 **基质含水率**、回水温度和主管压力获得独立灌溉窗口。

- 先开启旁通阀
- 再依次开启支路
- 异常时转入人工复核

关联 [[u:understanding-pressure-check]]。

> 单个峰值不作为最终结论。
`,
  updatedLabel: "大约 1 年前",
  contextCount: 128,
  mentionCount: 256,
  domainNames: ["工作", "前端", "后端", "AI"],
};

const masonryItems: UnderstandingCardView[] = [
  understanding,
  emptyUnderstanding,
  longUnderstanding,
  {
    ...understanding,
    id: "understanding-short",
    title: "环境提示比意志力更可靠",
    body: "把工具放到手边，比提醒自己「下次注意」有效。",
    updatedLabel: "3 天前",
    contextCount: 1,
    mentionCount: 0,
    domainNames: ["自我认知"],
  },
  {
    ...understanding,
    id: "understanding-list",
    title: "心智模型的迭代三段式",
    body: "对任何一个领域的理解，迭代遵循三个阶段：\n\n1. 先看见现象\n2. 再抽出机制\n3. 最后压成可迁移的判断\n\n不能跳过，也不能卡在某一阶段。",
    updatedLabel: "4 天前",
    contextCount: 2,
    mentionCount: 3,
    domainNames: ["三观"],
  },
  {
    ...understanding,
    id: "understanding-quote",
    title: "存在不需要被证明",
    body: "存在先于本质。我的存在本身不由任何人决定。",
    updatedLabel: "5 天前",
    contextCount: 1,
    mentionCount: 0,
    domainNames: ["三观"],
  },
];

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

function MasonryDemo() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
      {masonryItems.map((item) => (
        <div key={item.id} className="mb-3 break-inside-avoid">
          <UnderstandingCard
            understanding={item}
            selected={selectedId === item.id}
            canChat
            onSelect={setSelectedId}
            onAction={() => undefined}
          />
        </div>
      ))}
    </div>
  );
}

function UnderstandingCardShowcase() {
  return (
    <StoryShowcase
      title="Understanding Card"
      description="dashboard 瀑布流中的理解卡片：标题 + 全文摘要 + 领域/时间/上下文元数据。高度随正文变化。"
    >
      <StoryCase
        title="常规卡片"
        description="标题、摘要、领域标签与计数；点击可选中（bg-muted 高亮）。"
      >
        <CardDemo />
      </StoryCase>

      <StoryCase title="空理解与长正文">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">空理解</span>
            <CardDemo item={emptyUnderstanding} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">
              长正文与多领域
            </span>
            <CardDemo item={longUnderstanding} />
          </div>
        </div>
      </StoryCase>

      <StoryCase
        title="不等高瀑布流"
        description="正文长短不同时卡片各吃各的高度，不拉齐到同一行。"
      >
        <MasonryDemo />
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
