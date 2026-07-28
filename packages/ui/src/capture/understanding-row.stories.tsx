import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
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

const meta = {
  title: "Capture/基本组件/Understanding Row",
  component: UnderstandingRow,
  args: {
    understanding,
    onSelect: () => undefined,
    onAction: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] max-w-full rounded-lg border bg-background p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UnderstandingRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认、选中与菜单",
  render: () => <InteractiveRow />,
};

export const EmptyBody: Story = {
  name: "空正文与无关联",
  render: () => (
    <InteractiveRow
      item={{
        ...understanding,
        id: "understanding-empty",
        title: "尚未补充内容",
        body: "",
        contextCount: 0,
        connectionCount: 0,
      }}
    />
  ),
};

export const LongAndNarrow: Story = {
  name: "长标题、长摘要与窄容器",
  decorators: [
    (Story) => (
      <div className="w-72 max-w-full rounded-lg border bg-background p-2">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <InteractiveRow
      item={{
        ...understanding,
        id: "understanding-long",
        title: "这是一个非常长的 Understanding 标题，用来观察列表行截断",
        body: "这段 Markdown 摘要包含 **强调** 和大量中文内容。".repeat(10),
        updatedLabel: "大约 1 年前",
        contextCount: 128,
        connectionCount: 256,
      }}
    />
  ),
};

export const DisabledActions: Story = {
  name: "操作不可用",
  args: {
    understanding,
    canChat: true,
    actionsDisabled: true,
    onSelect: () => undefined,
    onAction: () => undefined,
  },
};
