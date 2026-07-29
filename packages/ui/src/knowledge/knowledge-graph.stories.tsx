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

function GraphDemo({
  data = normalGraph,
  initialSelection = "storybook",
  height = 480,
}: {
  data?: KnowledgeGraphData;
  initialSelection?: string | null;
  height?: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection);
  return (
    <div
      className="min-h-0 w-full overflow-hidden rounded-xl border bg-background"
      style={{ height }}
    >
      <KnowledgeGraph data={data} selectedId={selectedId} onSelectionChange={setSelectedId} />
    </div>
  );
}

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

function KnowledgeGraphShowcase() {
  return (
    <StoryShowcase
      title="Knowledge Graph"
      description="同页验收完整交互、空图、单节点、大规模关系图和窄容器 Resize。"
    >
      <StoryCase title="完整交互" description="选择、悬停、缩放、平移和适应画布。">
        <GraphDemo height={560} />
      </StoryCase>
      <StoryCase title="空图" description="没有 Understanding 和 Connection。">
        <GraphDemo data={{ nodes: [], edges: [] }} initialSelection={null} height={320} />
      </StoryCase>
      <StoryCase title="单节点" description="孤立 Understanding 不应被当成错误。">
        <GraphDemo
          data={{
            nodes: [{ id: "single", data: { title: "唯一的 Understanding", degree: 0 } }],
            edges: [],
          }}
          initialSelection="single"
          height={320}
        />
      </StoryCase>
      <StoryCase
        title="大量节点、关系与长标题"
        description="60 个节点和 92 条边下保持层级、选中和操作响应。"
      >
        <GraphDemo data={manyGraph} initialSelection="node-0" height={560} />
      </StoryCase>
      <StoryCase
        title="窄容器与 Resize"
        description="画布在 360px 宽度内重新布局，不向页面外溢出。"
      >
        <div className="w-[360px] max-w-full">
          <GraphDemo height={480} />
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
  name: "Knowledge Graph",
  render: () => <KnowledgeGraphShowcase />,
};
