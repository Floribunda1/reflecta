import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryShowcase } from "../../.storybook/story-showcase";
import { CanvasGraph } from "./CanvasGraph";
import { InteractiveGraph, StoryCaseSwitch } from "./canvas-story-graph";
import {
  edgeArrowheadDocument,
  edgeColorDocument,
  edgeLabelDocument,
  edgeLineStyleDocument,
  edgeRoutingDocument,
  edgeWidthDocument,
  typicalCanvasDocument,
} from "./canvas-story-fixtures";

function CanvasEdgesShowcase() {
  return (
    <StoryShowcase
      title="Canvas Edges"
      description="验收连线在图上的形状、线型、线宽、颜色、箭头和标签。同一时间只挂一张图。单击连线打开底部样式工具条。"
    >
      <StoryCaseSwitch
        cases={[
          {
            title: "形状",
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
