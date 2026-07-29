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
  excludedIds = ["server"],
  showPath,
  variant,
  fluid,
  disabled,
}: {
  nodes?: DomainTreeNodeView[];
  initialValue?: string[];
  excludedIds?: string[];
  showPath?: boolean;
  variant?: "default" | "inline";
  fluid?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<string[]>(initialValue);
  return (
    <DomainTreeSelect
      nodes={nodes}
      value={value}
      onValueChange={setValue}
      excludedIds={excludedIds}
      placeholder="选择一个或多个 Domain"
      showPath={showPath}
      variant={variant}
      fluid={fluid}
      disabled={disabled}
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
      description="集中验收选择模式、显示方式、异步生命周期、禁用限制和候选边界。"
    >
      <StoryCase title="选择模式" description="单选与多选并排展示，均可打开候选并修改结果。">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">多选</span>
            <SelectSurface>
              <MultipleDemo />
            </SelectSurface>
          </div>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">单选</span>
            <SelectSurface>
              <SingleDemo />
            </SelectSurface>
          </div>
        </div>
      </StoryCase>

      <StoryCase title="展示方式" description="完整路径、仅名称和 inline 形态使用同一组选中值。">
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">完整路径</span>
            <MultipleDemo />
          </div>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">仅名称</span>
            <MultipleDemo showPath={false} />
          </div>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">Inline</span>
            <MultipleDemo variant="inline" fluid={false} />
          </div>
        </div>
      </StoryCase>

      <StoryCase title="排除与禁用" description="被排除的 Server 不出现在候选中；禁用态不可打开。">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <SelectSurface>
            <MultipleDemo excludedIds={["server", "research"]} initialValue={["storybook"]} />
          </SelectSurface>
          <SelectSurface>
            <MultipleDemo disabled initialValue={["storybook"]} />
          </SelectSurface>
        </div>
      </StoryCase>

      <StoryCase title="候选生命周期" description="打开下拉后比较加载中、空结果与加载失败。">
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <DomainTreeSelect
            nodes={[]}
            value={[]}
            status="loading"
            onValueChange={() => undefined}
          />
          <DomainTreeSelect nodes={[]} value={[]} onValueChange={() => undefined} />
          <DomainTreeSelect
            nodes={[]}
            value={[]}
            status="error"
            errorText="无法加载 Domain，请稍后重试"
            onValueChange={() => undefined}
          />
        </div>
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
