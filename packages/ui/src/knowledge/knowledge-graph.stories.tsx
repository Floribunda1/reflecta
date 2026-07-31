import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { KnowledgeGraph } from "./knowledge-graph";
import type { KnowledgeGraphData } from "./knowledge-graph-state";

const normalGraph: KnowledgeGraphData = {
  nodes: [
    { id: "storybook", data: { title: "Storybook 组件验收", degree: 4 } },
    { id: "streaming", data: { title: "Streaming Identity", degree: 3 } },
    { id: "tool", data: { title: "Agent Tool", degree: 3 } },
    { id: "proposal", data: { title: "Proposal 审批", degree: 2 } },
    { id: "markdown", data: { title: "Markdown 完整语法", degree: 3 } },
    { id: "capture", data: { title: "Capture 组件边界", degree: 2 } },
    { id: "domain", data: { title: "Domain Tree", degree: 2 } },
    { id: "graph", data: { title: "Knowledge Graph", degree: 1 } },
    { id: "isolated", data: { title: "暂未建立关联", degree: 0 } },
  ],
  edges: [
    { id: "storybook-streaming", source: "storybook", target: "streaming" },
    { id: "storybook-markdown", source: "storybook", target: "markdown" },
    { id: "storybook-capture", source: "storybook", target: "capture" },
    { id: "storybook-graph", source: "storybook", target: "graph" },
    { id: "streaming-tool", source: "streaming", target: "tool" },
    { id: "streaming-proposal", source: "streaming", target: "proposal" },
    { id: "tool-proposal", source: "tool", target: "proposal" },
    { id: "tool-markdown", source: "tool", target: "markdown" },
    { id: "capture-domain", source: "capture", target: "domain" },
  ],
};

const disconnectedGraph: KnowledgeGraphData = {
  nodes: [
    { id: "a", data: { title: "未关联的现场记录", degree: 0 } },
    { id: "b", data: { title: "独立的控制策略", degree: 0 } },
    { id: "c", data: { title: "待整理的复验结论", degree: 0 } },
  ],
  edges: [],
};

const clusterGraph: KnowledgeGraphData = {
  nodes: Array.from({ length: 8 }, (_, index) => ({
    id: `cluster-${index}`,
    data: { title: `簇节点 ${index + 1}`, degree: index % 4 },
  })),
  edges: [
    { id: "cluster-a1", source: "cluster-0", target: "cluster-1" },
    { id: "cluster-a2", source: "cluster-1", target: "cluster-2" },
    { id: "cluster-a3", source: "cluster-2", target: "cluster-3" },
    { id: "cluster-b1", source: "cluster-4", target: "cluster-5" },
    { id: "cluster-b2", source: "cluster-5", target: "cluster-6" },
    { id: "cluster-b3", source: "cluster-6", target: "cluster-7" },
  ],
};

const cycleGraph: KnowledgeGraphData = {
  nodes: Array.from({ length: 5 }, (_, index) => ({
    id: `cycle-${index}`,
    data: { title: `循环关系 ${index + 1}`, degree: 2 },
  })),
  edges: Array.from({ length: 5 }, (_, index) => ({
    id: `cycle-edge-${index}`,
    source: `cycle-${index}`,
    target: `cycle-${(index + 1) % 5}`,
  })),
};

const contentGraph: KnowledgeGraphData = {
  nodes: [
    {
      id: "long-cn",
      data: {
        title: "这是一个非常长的 Understanding 标题，用于观察单行标签截断是否稳定",
        degree: 2,
      },
    },
    {
      id: "long-en",
      data: {
        title: "A very long mixed-language knowledge node without an early natural breakpoint",
        degree: 2,
      },
    },
    { id: "emoji", data: { title: "极地温室复验 🌱", degree: 2 } },
  ],
  edges: [
    { id: "content-1", source: "long-cn", target: "long-en" },
    { id: "content-2", source: "long-cn", target: "emoji" },
  ],
};

const manyGraph: KnowledgeGraphData = {
  nodes: Array.from({ length: 60 }, (_, index) => ({
    id: `node-${index}`,
    data: {
      title:
        index % 8 === 0
          ? `第 ${index + 1} 个包含非常长标题的 Understanding 节点`
          : `Understanding ${index + 1}`,
      degree: index === 0 ? 20 : index % 7,
    },
  })),
  edges: Array.from({ length: 92 }, (_, index) => {
    const source = index % 60;
    const target = (index * 7 + 3) % 60;
    return {
      id: `edge-${index}`,
      source: `node-${source}`,
      target: `node-${target === source ? (target + 1) % 60 : target}`,
    };
  }),
};

function GraphDemo({
  data = normalGraph,
  initialSelection = null,
  height = 480,
}: {
  data?: KnowledgeGraphData;
  initialSelection?: string | null;
  height?: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection);
  return (
    <div className="grid min-w-0 gap-2">
      <div
        className="min-h-0 w-full overflow-hidden rounded-xl border bg-background"
        style={{ height }}
      >
        <KnowledgeGraph data={data} selectedId={selectedId} onSelectionChange={setSelectedId} />
      </div>
      <p className="truncate text-xs text-muted-foreground">
        当前选择：{selectedId ?? "无（点击画布可清除）"}
      </p>
    </div>
  );
}

function LabeledGraph({ label, ...props }: { label: string } & Parameters<typeof GraphDemo>[0]) {
  return (
    <div className="grid min-w-0 gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <GraphDemo {...props} />
    </div>
  );
}

function KnowledgeGraphInteractionShowcase() {
  return (
    <StoryShowcase
      title="Knowledge Graph · 核心交互"
      description="验收关系图的默认布局、选择、邻接与视口交互。"
    >
      <StoryCase
        title="基础图谱"
        description="点击节点、拖动画布、缩放和适应画布；孤立节点仍作为正常知识存在。"
      >
        <GraphDemo />
      </StoryCase>
      <StoryCase
        title="选择与关系"
        description="默认选中 Storybook，邻接节点和边保持强调，非邻接内容退后；点击空白可取消。"
      >
        <GraphDemo initialSelection="storybook" />
      </StoryCase>
    </StoryShowcase>
  );
}

function KnowledgeGraphTopologyShowcase() {
  return (
    <StoryShowcase
      title="Knowledge Graph · 数据拓扑"
      description="比较空、单节点、完全断开、多簇和环形关系。"
    >
      <StoryCase
        title="数据拓扑"
        description="空、单节点、完全断开、多簇和环形关系在同一位置比较。"
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <LabeledGraph label="空图" data={{ nodes: [], edges: [] }} height={260} />
          <LabeledGraph
            label="单节点"
            data={{
              nodes: [
                {
                  id: "single",
                  data: { title: "唯一的 Understanding", degree: 0 },
                },
              ],
              edges: [],
            }}
            initialSelection="single"
            height={260}
          />
          <LabeledGraph label="完全断开" data={disconnectedGraph} height={260} />
          <LabeledGraph label="两个关系簇" data={clusterGraph} height={260} />
          <LabeledGraph label="循环关系" data={cycleGraph} height={260} />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

function KnowledgeGraphScaleShowcase() {
  return (
    <StoryShowcase
      title="Knowledge Graph · 规模与内容"
      description="验收大数据量、长标题、Emoji 与主题变化。"
    >
      <StoryCase
        title="大规模图谱"
        description="60 个节点和 92 条边下观察标签优先级、密度、选择与操作响应。"
      >
        <GraphDemo data={manyGraph} initialSelection="node-0" height={600} />
      </StoryCase>
      <StoryCase
        title="内容与主题"
        description="长中英文标题和 Emoji 保持可读；使用 Storybook 主题工具栏切换深浅色。"
      >
        <GraphDemo data={contentGraph} initialSelection="long-cn" height={360} />
      </StoryCase>
    </StoryShowcase>
  );
}

function KnowledgeGraphContainerShowcase() {
  return (
    <StoryShowcase
      title="Knowledge Graph · 容器变化"
      description="验收同一张图在不同画布尺寸下的布局和边界。"
    >
      <StoryCase
        title="容器变化"
        description="同一张图在宽、窄和矮容器中重新布局，不向页面外溢出。"
      >
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <LabeledGraph label="宽容器" height={360} />
          <div className="grid min-w-0 grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start gap-6">
            <LabeledGraph label="窄容器" height={360} />
            <LabeledGraph label="矮容器" height={220} />
          </div>
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Knowledge Wander/基本组件",
  component: KnowledgeGraph,
  args: {
    data: normalGraph,
    selectedId: "storybook",
    onSelectionChange: () => undefined,
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof KnowledgeGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KnowledgeGraphStory: Story = {
  name: "Knowledge Graph · 核心交互",
  render: () => <KnowledgeGraphInteractionShowcase />,
};

export const KnowledgeGraphTopologies: Story = {
  name: "Knowledge Graph · 数据拓扑",
  render: () => <KnowledgeGraphTopologyShowcase />,
};

export const KnowledgeGraphScale: Story = {
  name: "Knowledge Graph · 规模与内容",
  render: () => <KnowledgeGraphScaleShowcase />,
};

export const KnowledgeGraphContainers: Story = {
  name: "Knowledge Graph · 容器变化",
  render: () => <KnowledgeGraphContainerShowcase />,
};
