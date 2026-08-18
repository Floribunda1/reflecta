import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { CanvasGraph } from "./CanvasGraph";

/**
 * CanvasGraph（X6 生命周期封装 + 语义事件桥）。
 *
 * Phase 0 骨架：展示空画布（点阵网格）的编辑态与只读态；
 * 五类元素 shape 随 Phase 1 落地后补充对应 case。
 */
function CanvasGraphShowcase() {
  return (
    <StoryShowcase
      title="CanvasGraph"
      description="X6 画布生命周期封装：挂载建图、卸载释放；只读渲染（interacting: false）服务 F1 三用组件。"
    >
      <StoryCase
        title="编辑模式（空画布）"
        description="挂载即建图：点阵网格、平移、滚轮缩放（Ctrl/Cmd + 滚轮）。"
        contentClassName="h-[420px]"
      >
        <CanvasGraph />
      </StoryCase>
      <StoryCase
        title="只读模式（interacting: false）"
        description="F1 只读渲染器（[[cv:]] Modal / draft 预览 / artifact 缩略）共用；禁用全部交互。"
        contentClassName="h-[420px]"
      >
        <CanvasGraph readonly />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Canvas/CanvasGraph",
  component: CanvasGraph,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GraphShowcase: Story = {
  render: () => <CanvasGraphShowcase />,
};
