import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { UnderstandingRow, type UnderstandingRowView } from "./understanding-row";

const understanding: UnderstandingRowView = {
  id: "understanding-irrigation",
  title: "低温环境下的分区灌溉策略",
  body: "不同种植槽根据 **基质含水率**、回水温度和主管压力获得独立灌溉窗口。",
  updatedLabel: "12 分钟前",
  contextCount: 4,
  connectionCount: 7,
};

const emptyUnderstanding: UnderstandingRowView = {
  ...understanding,
  id: "understanding-empty",
  title: "尚未补充正文的理解",
  body: "",
  updatedLabel: "刚刚",
  contextCount: 0,
  connectionCount: 0,
};

const longUnderstanding: UnderstandingRowView = {
  ...understanding,
  id: "understanding-long",
  title: "这是一个非常长的 Understanding 标题，用来观察标题与更新时间同时存在时是否正确截断",
  body: "这段 Markdown 摘要包含 **强调**、[来源链接](https://example.com) 和大量中英文内容，用来观察真实列表宽度下的三行截断。".repeat(
    8,
  ),
  updatedLabel: "大约 1 年前",
  contextCount: 128,
  connectionCount: 256,
};

function RowDemo({
  item = understanding,
  selected = false,
  canChat = true,
  actionsDisabled = false,
}: {
  item?: UnderstandingRowView;
  selected?: boolean;
  canChat?: boolean;
  actionsDisabled?: boolean;
}) {
  const [currentSelected, setCurrentSelected] = useState(selected);
  const [lastAction, setLastAction] = useState("右键可以查看项目操作");
  return (
    <div className="grid gap-2">
      <UnderstandingRow
        understanding={item}
        selected={currentSelected}
        canChat={canChat}
        actionsDisabled={actionsDisabled}
        onSelect={() => setCurrentSelected((current) => !current)}
        onAction={(action) => setLastAction(`${action.type}：${action.understanding.title}`)}
      />
      <p className="px-2 text-xs text-muted-foreground">{lastAction}</p>
    </div>
  );
}

function RowSurface({
  label,
  width = "w-[420px]",
  children,
}: {
  label: string;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${width} max-w-full`}>
      <span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function UnderstandingRowShowcase() {
  return (
    <StoryShowcase
      title="Understanding Row"
      description="集中比较选择、内容密度、行操作，以及长标题和 Markdown 摘要的截断。"
    >
      <StoryCase
        title="基础与选择"
        description="默认与选中态并排展示；仍可点击切换并用键盘聚焦检查 Focus。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <RowSurface label="默认">
            <RowDemo />
          </RowSurface>
          <RowSurface label="选中">
            <RowDemo selected />
          </RowSurface>
        </div>
      </StoryCase>

      <StoryCase title="内容密度" description="完整摘要与空正文、零关联并排比较。">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <RowSurface label="完整内容">
            <RowDemo />
          </RowSurface>
          <RowSurface label="空正文与无关联">
            <RowDemo item={emptyUnderstanding} canChat={false} />
          </RowSurface>
        </div>
      </StoryCase>

      <StoryCase title="行操作" description="右键比较可聊天、不可聊天和全部操作不可用的菜单结构。">
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <RowSurface label="允许聊天">
            <RowDemo />
          </RowSurface>
          <RowSurface label="不允许聊天">
            <RowDemo canChat={false} />
          </RowSurface>
          <RowSurface label="操作不可用">
            <RowDemo actionsDisabled />
          </RowSurface>
        </div>
      </StoryCase>

      <StoryCase
        title="标题与摘要截断"
        description="标准列表宽度、窄容器和选中态使用同一份长内容，文字不能撑破行宽。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <RowSurface label="标准宽度">
            <RowDemo item={longUnderstanding} />
          </RowSurface>
          <RowSurface label="窄容器" width="w-72">
            <RowDemo item={longUnderstanding} />
          </RowSurface>
          <RowSurface label="选中 + 长内容">
            <RowDemo item={longUnderstanding} selected />
          </RowSurface>
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/基本组件",
  component: UnderstandingRow,
  args: {
    understanding,
    onSelect: () => undefined,
    onAction: () => undefined,
  },
} satisfies Meta<typeof UnderstandingRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderstandingRowStory: Story = {
  name: "Understanding Row",
  render: () => <UnderstandingRowShowcase />,
};
