import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
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

function MultipleDemo({
  nodes = domains,
  initialValue = ["storybook", "research"],
}: {
  nodes?: DomainTreeNodeView[];
  initialValue?: string[];
}) {
  const [value, setValue] = useState<string[]>(initialValue);
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

const manyDeepDomains: DomainTreeNodeView[] = [
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
];

function SelectSurface({ children }: { children: React.ReactNode }) {
  return <div className="w-[420px] max-w-full">{children}</div>;
}

function DomainTreeSelectShowcase() {
  return (
    <StoryShowcase
      title="Domain Tree Select"
      description="集中验收单选、多选、异步状态，以及大量深层候选在窄容器中的表现。"
    >
      <StoryCase title="多选" description="展示完整路径、多个已选项和排除项。">
        <SelectSurface>
          <MultipleDemo />
        </SelectSurface>
      </StoryCase>
      <StoryCase title="单选" description="用于选择唯一父 Domain。">
        <SelectSurface>
          <SingleDemo />
        </SelectSurface>
      </StoryCase>
      <StoryCase title="加载中">
        <SelectSurface>
          <DomainTreeSelect
            nodes={[]}
            value={[]}
            status="loading"
            onValueChange={() => undefined}
          />
        </SelectSurface>
      </StoryCase>
      <StoryCase title="加载失败">
        <SelectSurface>
          <DomainTreeSelect
            nodes={[]}
            value={[]}
            status="error"
            errorText="无法加载 Domain，请稍后重试"
            onValueChange={() => undefined}
          />
        </SelectSurface>
      </StoryCase>
      <StoryCase
        title="大量候选、深路径与窄容器"
        description="展开候选后可观察长名称截断、深层缩进和滚动边界。"
      >
        <div className="w-72 max-w-full">
          <MultipleDemo nodes={manyDeepDomains} initialValue={[]} />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/基本组件",
  component: DomainTreeSelect,
  args: {
    nodes: domains,
    value: [],
    onValueChange: () => undefined,
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DomainTreeSelectStory: Story = {
  name: "Domain Tree Select",
  render: () => <DomainTreeSelectShowcase />,
};
