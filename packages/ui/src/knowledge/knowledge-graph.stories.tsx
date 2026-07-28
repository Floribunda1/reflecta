import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
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
}: {
  data?: KnowledgeGraphData;
  initialSelection?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection);
  return (
    <div className="h-[680px] min-h-0 w-full overflow-hidden rounded-xl border bg-background">
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

const meta = {
  title: "Knowledge Wander/基本组件/Knowledge Graph",
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

export const Interactive: Story = {
  name: "选择、悬停、缩放与适应画布",
  render: () => <GraphDemo />,
};

export const Empty: Story = {
  name: "空图",
  render: () => <GraphDemo data={{ nodes: [], edges: [] }} initialSelection={null} />,
};

export const SingleNode: Story = {
  name: "单节点",
  render: () => (
    <GraphDemo
      data={{
        nodes: [{ id: "single", data: { title: "唯一的 Understanding", degree: 0 } }],
        edges: [],
      }}
      initialSelection="single"
    />
  ),
};

export const ManyNodesAndLongTitles: Story = {
  name: "大量节点、关系与长标题",
  render: () => <GraphDemo data={manyGraph} initialSelection="node-0" />,
};

export const NarrowContainer: Story = {
  name: "窄容器与 Resize",
  decorators: [
    (Story) => (
      <div className="mx-auto w-[360px] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => <GraphDemo />,
};
