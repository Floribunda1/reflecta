import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { UnderstandingRow, type UnderstandingRowView } from "./understanding-row";

const understanding: UnderstandingRowView = {
  id: "understanding-storybook",
  title: "Storybook 只验收高价值组件",
  body: "组件需要具备 **定制样式**、独特交互或丰富状态，并且独立展示能降低验收成本。",
  updatedLabel: "12 分钟前",
  contextCount: 4,
  connectionCount: 7,
};

function InteractiveRow({ item = understanding }: { item?: UnderstandingRowView }) {
  const [selected, setSelected] = useState(false);
  const [lastAction, setLastAction] = useState("右键可以查看项目操作");
  return (
    <div className="grid gap-2">
      <UnderstandingRow
        understanding={item}
        selected={selected}
        canChat
        onSelect={() => setSelected((current) => !current)}
        onAction={(action) => setLastAction(`${action.type}：${action.understanding.title}`)}
      />
      <div className="px-2 text-xs text-muted-foreground">{lastAction}</div>
    </div>
  );
}

const emptyUnderstanding: UnderstandingRowView = {
  ...understanding,
  id: "understanding-empty",
  title: "尚未补充内容",
  body: "",
  contextCount: 0,
  connectionCount: 0,
};

const longUnderstanding: UnderstandingRowView = {
  ...understanding,
  id: "understanding-long",
  title: "这是一个非常长的 Understanding 标题，用来观察列表行截断",
  body: "这段 Markdown 摘要包含 **强调** 和大量中文内容。".repeat(10),
  updatedLabel: "大约 1 年前",
  contextCount: 128,
  connectionCount: 256,
};

function RowSurface({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div
      className={`${narrow ? "w-72" : "w-[420px]"} max-w-full rounded-lg border bg-background p-2`}
    >
      {children}
    </div>
  );
}

function UnderstandingRowShowcase() {
  return (
    <StoryShowcase
      title="Understanding Row"
      description="集中验收默认与选中交互、空内容、禁用操作，以及长标题和长摘要的截断。"
    >
      <StoryCase title="默认、选中与菜单" description="点击切换选中状态，右键打开项目操作菜单。">
        <RowSurface>
          <InteractiveRow />
        </RowSurface>
      </StoryCase>
      <StoryCase title="空正文与无关联" description="没有摘要、Context 和 Connection。">
        <RowSurface>
          <InteractiveRow item={emptyUnderstanding} />
        </RowSurface>
      </StoryCase>
      <StoryCase title="操作不可用" description="保留菜单结构，但所有项目操作不可执行。">
        <RowSurface>
          <UnderstandingRow
            understanding={understanding}
            canChat
            actionsDisabled
            onSelect={() => undefined}
            onAction={() => undefined}
          />
        </RowSurface>
      </StoryCase>
      <StoryCase
        title="长标题、长摘要与窄容器"
        description="标题、时间、摘要和统计信息不能撑破列表宽度。"
      >
        <RowSurface narrow>
          <InteractiveRow item={longUnderstanding} />
        </RowSurface>
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
