import { arrayMove } from "@dnd-kit/sortable";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DomainTree, type DomainTreeAction, type DomainTreeNodeView } from "./domain-tree";

const initialDomains: DomainTreeNodeView[] = [
  {
    id: "product",
    name: "产品",
    children: [
      { id: "positioning", name: "定位与价值主张", children: [] },
      { id: "research", name: "用户研究", children: [] },
    ],
  },
  {
    id: "technology",
    name: "技术",
    children: [
      {
        id: "ui",
        name: "UI 架构",
        children: [
          { id: "storybook", name: "Storybook 组件验收", children: [] },
          { id: "streaming", name: "Agent Streaming Identity", children: [] },
        ],
      },
      { id: "server", name: "Server 与数据持久化", children: [] },
    ],
  },
  { id: "practice", name: "实践与复盘", children: [] },
];

function reorderSiblings(
  nodes: readonly DomainTreeNodeView[],
  activeId: string,
  overId: string,
): DomainTreeNodeView[] {
  const activeIndex = nodes.findIndex((node) => node.id === activeId);
  const overIndex = nodes.findIndex((node) => node.id === overId);
  if (activeIndex >= 0 && overIndex >= 0) return arrayMove([...nodes], activeIndex, overIndex);
  return nodes.map((node) => ({
    ...node,
    children: reorderSiblings(node.children, activeId, overId),
  }));
}

function InteractiveTree({
  initialNodes = initialDomains,
}: {
  initialNodes?: DomainTreeNodeView[];
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedId, setSelectedId] = useState<string | null>("storybook");
  const [expandedIds, setExpandedIds] = useState(["technology", "ui"]);
  const [lastAction, setLastAction] = useState("尚未执行菜单操作");

  const handleToggle = (id: string) => {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const handleAction = (action: DomainTreeAction) => {
    const labels = {
      chat: "和 AI 聊聊",
      "create-child": "新建子领域",
      edit: "编辑",
      delete: "删除",
    };
    setLastAction(`${labels[action.type]}：${action.node.name}`);
  };

  return (
    <div className="grid w-72 max-w-full gap-3 rounded-lg border bg-background p-2">
      <DomainTree
        nodes={nodes}
        selectedId={selectedId}
        expandedIds={expandedIds}
        canChat
        onSelect={setSelectedId}
        onToggle={handleToggle}
        onAction={handleAction}
        onReorder={(activeId, overId) =>
          setNodes((current) => reorderSiblings(current, activeId, overId))
        }
      />
      <div className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
        {lastAction}
      </div>
    </div>
  );
}

const meta = {
  title: "Capture/基本组件/Domain Tree",
  component: DomainTree,
  args: {
    nodes: initialDomains,
    selectedId: "storybook",
    expandedIds: ["technology", "ui"],
    onSelect: () => undefined,
    onToggle: () => undefined,
    onAction: () => undefined,
  },
} satisfies Meta<typeof DomainTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  name: "选择、展开、菜单与拖拽",
  render: () => <InteractiveTree />,
};

export const Empty: Story = {
  name: "空状态",
  args: {
    nodes: [],
    selectedId: null,
    expandedIds: [],
    onSelect: () => undefined,
    onToggle: () => undefined,
    onAction: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-72 rounded-lg border bg-background p-2">
        <Story />
      </div>
    ),
  ],
};

export const DeepAndLong: Story = {
  name: "深层级、长名称与窄容器",
  render: () => (
    <InteractiveTree
      initialNodes={[
        {
          id: "root-long",
          name: "这是一个非常长的顶级 Domain 名称，用于观察截断",
          children: [
            {
              id: "level-2",
              name: "第二层级的名称同样非常长",
              children: [
                {
                  id: "level-3",
                  name: "第三层级",
                  children: [
                    {
                      id: "level-4",
                      name: "第四层级直到内容空间非常有限",
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]}
    />
  ),
};
