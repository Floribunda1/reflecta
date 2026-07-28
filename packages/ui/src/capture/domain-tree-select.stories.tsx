import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { DomainTreeNodeView } from "./domain-tree";
import { DomainTreeSelect } from "./domain-tree-select";

const domains: DomainTreeNodeView[] = [
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
];

function MultipleDemo({ nodes = domains }: { nodes?: DomainTreeNodeView[] }) {
  const [value, setValue] = useState<string[]>(["storybook", "research"]);
  return (
    <DomainTreeSelect
      nodes={nodes}
      value={value}
      onValueChange={setValue}
      excludedIds={["server"]}
      placeholder="选择一个或多个 Domain"
    />
  );
}

function SingleDemo() {
  const [value, setValue] = useState<string | null>("ui");
  return (
    <DomainTreeSelect
      mode="single"
      nodes={domains}
      value={value}
      onValueChange={setValue}
      placeholder="选择父 Domain"
    />
  );
}

const meta = {
  title: "Capture/基本组件/Domain Tree Select",
  component: DomainTreeSelect,
  args: {
    nodes: domains,
    value: [],
    onValueChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Multiple: Story = {
  name: "多选、路径与排除项",
  render: () => <MultipleDemo />,
};

export const Single: Story = {
  name: "单选",
  render: () => <SingleDemo />,
};

export const Loading: Story = {
  name: "加载中",
  render: () => (
    <DomainTreeSelect nodes={[]} value={[]} status="loading" onValueChange={() => undefined} />
  ),
};

export const Error: Story = {
  name: "加载失败",
  render: () => (
    <DomainTreeSelect
      nodes={[]}
      value={[]}
      status="error"
      errorText="无法加载 Domain，请稍后重试"
      onValueChange={() => undefined}
    />
  ),
};

export const ManyDeepAndNarrow: Story = {
  name: "大量候选、深路径与窄容器",
  decorators: [
    (Story) => (
      <div className="w-72 max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <MultipleDemo
      nodes={[
        {
          id: "long-root",
          name: "一个非常长的顶级 Domain",
          children: Array.from({ length: 24 }, (_, index) => ({
            id: `long-child-${index}`,
            name: `第 ${index + 1} 个候选 Domain · 包含较长名称`,
            children:
              index === 0
                ? [
                    {
                      id: "deep-child",
                      name: "第二层 / 第三层 / 最深的候选项",
                      children: [],
                    },
                  ]
                : [],
          })),
        },
      ]}
    />
  ),
};
