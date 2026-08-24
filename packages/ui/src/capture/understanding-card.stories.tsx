import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import {
  emptyCard,
  longCard,
  resolveStoryWikiLink,
  typicalCard,
  typicalCards,
  untitledCard,
  type CaptureStoryCard,
} from "./capture-story-fixtures";
import { UnderstandingCard } from "./understanding-card";

function CardDemo({
  item = typicalCard,
  selected = false,
  canChat = true,
  actionsDisabled = false,
}: {
  item?: CaptureStoryCard;
  selected?: boolean;
  canChat?: boolean;
  actionsDisabled?: boolean;
}) {
  const [currentSelected, setCurrentSelected] = useState(selected);
  const [lastAction, setLastAction] = useState("右键可以查看卡片操作");
  return (
    <div className="grid max-w-sm gap-2">
      <UnderstandingCard
        understanding={item}
        selected={currentSelected}
        canChat={canChat}
        actionsDisabled={actionsDisabled}
        resolveWikiLink={resolveStoryWikiLink}
        onSelect={() => setCurrentSelected((current) => !current)}
        onAction={(action) => setLastAction(`${action.type}：${action.understanding.title}`)}
      />
      <p className="text-xs text-muted-foreground">{lastAction}</p>
    </div>
  );
}

function CardSurface({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function GridDemo() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {typicalCards.map((item) => (
        <UnderstandingCard
          key={item.id}
          understanding={item}
          selected={selectedId === item.id}
          canChat
          resolveWikiLink={resolveStoryWikiLink}
          onSelect={setSelectedId}
          onAction={() => undefined}
        />
      ))}
    </div>
  );
}

function UnderstandingCardShowcase() {
  return (
    <StoryShowcase
      title="Understanding Card"
      description="dashboard 网格中的理解卡片：标题、五行预览、领域标签与计数。同行卡片等高。"
    >
      <StoryCase
        title="选择"
        description="未选中与选中并排；点击可切换。选中使用 bg-muted，与 Domain Tree 同一约定。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <CardSurface label="未选中">
            <CardDemo />
          </CardSurface>
          <CardSurface label="选中">
            <CardDemo selected />
          </CardSurface>
        </div>
      </StoryCase>

      <StoryCase
        title="正文"
        description="有摘要、空理解、未命名标题，以及五行截断和 Wiki Link 解析。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-2 xl:grid-cols-4">
          <CardSurface label="有摘要">
            <CardDemo />
          </CardSurface>
          <CardSurface label="空理解">
            <CardDemo item={emptyCard} />
          </CardSurface>
          <CardSurface label="未命名标题">
            <CardDemo item={untitledCard} />
          </CardSurface>
          <CardSurface label="长正文与 Wiki Link">
            <CardDemo item={longCard} />
          </CardSurface>
        </div>
      </StoryCase>

      <StoryCase
        title="元数据"
        description="领域标签在 0、2 个和溢出 +N 之间的展示；计数可为 0 或很大。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <CardSurface label="无领域 · 零计数">
            <CardDemo item={emptyCard} />
          </CardSurface>
          <CardSurface label="单领域">
            <CardDemo />
          </CardSurface>
          <CardSurface label="溢出 +N · 大计数">
            <CardDemo item={longCard} />
          </CardSurface>
        </div>
      </StoryCase>

      <StoryCase title="菜单" description="右键比较允许聊天、不允许聊天和全部操作不可用。">
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <CardSurface label="允许聊天">
            <CardDemo />
          </CardSurface>
          <CardSurface label="不允许聊天">
            <CardDemo canChat={false} />
          </CardSurface>
          <CardSurface label="操作不可用">
            <CardDemo actionsDisabled />
          </CardSurface>
        </div>
      </StoryCase>

      <StoryCase title="网格" description="长短正文都停在预览窗内，同一行卡片拉齐。点击可选中。">
        <GridDemo />
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
    understanding: typicalCard,
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
