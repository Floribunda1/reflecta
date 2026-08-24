import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryShowcase } from "../../.storybook/story-showcase";
import { Button } from "../components/button";
import { CanvasGraph, type CanvasGraphHandle } from "./CanvasGraph";
import { GraphFrame, InteractiveGraph, StoryCaseSwitch } from "./canvas-story-graph";
import {
  edgeArrowheadDocument,
  edgeColorDocument,
  edgeLabelDocument,
  edgeLineStyleDocument,
  edgeRoutingDocument,
  edgeWidthDocument,
  typicalCanvasDocument,
  typicalShapeData,
} from "./canvas-story-fixtures";
import type { CanvasDocument, CanvasEdgeDTO } from "./document";

const PATH_OPTIONS = [
  {
    value: "curve",
    label: "曲线",
    description: "适合表达柔和的关系",
    config: { router: null, connector: { name: "smooth" } },
  },
  {
    value: "straight",
    label: "直线",
    description: "两点之间直接连接",
    config: { router: null, connector: { name: "normal" } },
  },
  {
    value: "orthogonal",
    label: "正交",
    description: "按端口方向自动避让",
    config: {
      router: {
        name: "manhattan",
        args: { padding: 20, startDirections: ["right"], endDirections: ["left"] },
      },
      connector: { name: "rounded", args: { radius: 8 } },
    },
  },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  description: string;
  config: Pick<CanvasEdgeDTO, "router" | "connector">;
}>;

const pathDemoSource = edgeRoutingDocument.elements[0];
const pathDemoTarget = edgeRoutingDocument.elements[1];
if (pathDemoSource?.kind !== "text" || pathDemoTarget?.kind !== "text") {
  throw new Error("Edge path Story requires two text elements");
}

const PATH_DEMO_DOCUMENT: CanvasDocument = {
  elements: [
    {
      ...pathDemoSource,
      x: 48,
      y: 48,
      width: 220,
      height: 120,
      props: { ...pathDemoSource.props, text: "起点" },
    },
    {
      ...pathDemoTarget,
      x: 560,
      y: 280,
      width: 220,
      height: 120,
      props: { ...pathDemoTarget.props, text: "终点" },
    },
  ],
  edges: [{ ...edgeRoutingDocument.edges[0], label: null }],
};

function EdgePathEditorProposal() {
  const graphRef = useRef<CanvasGraphHandle>(null);
  const [selected, setSelected] = useState<(typeof PATH_OPTIONS)[number]>(PATH_OPTIONS[0]);

  const selectPath = (option: (typeof PATH_OPTIONS)[number]) => {
    setSelected(option);
    graphRef.current?.updateEdge({ ...PATH_DEMO_DOCUMENT.edges[0], ...option.config });
  };

  return (
    <StoryShowcase
      title="Edge Path Editor Proposal"
      description="用户只选择可预测的路径效果；右侧展示实际写入的 X6 原生配置。"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1">
            <span className="px-2 text-sm text-muted-foreground">路径</span>
            {PATH_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={selected.value === option.value ? "secondary" : "ghost"}
                onClick={() => selectPath(option)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <GraphFrame height="h-[460px]">
            <CanvasGraph
              ref={graphRef}
              document={PATH_DEMO_DOCUMENT}
              readonly
              viewportReady
              shapeData={typicalShapeData}
              className="absolute inset-0"
            />
          </GraphFrame>
        </div>
        <div className="grid content-start gap-2 rounded-lg border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-medium">{selected.label}</p>
            <p className="text-sm text-muted-foreground">{selected.description}</p>
          </div>
          <pre className="overflow-auto rounded-md border bg-background p-3 text-xs">
            {JSON.stringify(selected.config, null, 2)}
          </pre>
          <p className="text-xs text-muted-foreground">
            正交路径的 startDirections / endDirections 直接来自 source.port / target.port。
          </p>
        </div>
      </div>
    </StoryShowcase>
  );
}

function CanvasEdgesShowcase() {
  return (
    <StoryShowcase
      title="Canvas Edges"
      description="验收连线的路径、线型、线宽、颜色、箭头和标签。同一时间只挂一张图。单击连线打开底部配置工具条。"
    >
      <StoryCaseSwitch
        cases={[
          {
            title: "路径",
            description: "曲线 / 直线 / 正交。",
            content: <InteractiveGraph document={edgeRoutingDocument} height="h-[360px]" />,
          },
          {
            title: "线型",
            description: "实线 / 虚线 / 点线。",
            content: <InteractiveGraph document={edgeLineStyleDocument} height="h-[360px]" />,
          },
          {
            title: "线宽",
            description: "细 / 中 / 粗。",
            content: <InteractiveGraph document={edgeWidthDocument} height="h-[360px]" />,
          },
          {
            title: "颜色",
            description: "默认色与五档 chart token。",
            content: <InteractiveGraph document={edgeColorDocument} height="h-[620px]" />,
          },
          {
            title: "箭头",
            description: "classic / block / circle / diamond / cross / ellipse / 无。",
            content: <InteractiveGraph document={edgeArrowheadDocument} height="h-[700px]" />,
          },
          {
            title: "标签",
            description: "无标签、短标签、长标签。双击连线就地编辑标签。",
            content: <InteractiveGraph document={edgeLabelDocument} height="h-[360px]" />,
          },
        ]}
      />
    </StoryShowcase>
  );
}

const meta = {
  title: "Canvas/基本组件",
  component: CanvasGraph,
  parameters: {
    layout: "padded",
  },
  args: {
    document: typicalCanvasDocument,
    viewportReady: true,
  },
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanvasEdgesStory: Story = {
  name: "Canvas Edges",
  render: () => <CanvasEdgesShowcase />,
};

export const EdgePathEditorProposalStory: Story = {
  name: "Edge Path Editor Proposal",
  render: () => <EdgePathEditorProposal />,
};
