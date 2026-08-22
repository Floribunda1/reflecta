import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { CanvasGraph } from "./CanvasGraph";
import { InteractiveGraph } from "./canvas-story-graph";
import {
  canvasRefCardsDocument,
  groupCardsDocument,
  textCardsDocument,
  typicalCanvasDocument,
  understandingCardsDocument,
} from "./canvas-story-fixtures";

function CanvasCardsShowcase() {
  return (
    <StoryShowcase
      title="Canvas Cards"
      description="验收四种画布卡片在图上的形态：理解、文本、组、画布引用。状态都落在画布节点上，不脱离图单独摆放。"
    >
      <StoryCase
        title="理解卡"
        description="从左到右：典型正文、无标题、引用已删除；下一行是长标题滚动和着色。单击选中后出现操作条。"
      >
        <InteractiveGraph document={understandingCardsDocument} height="h-[560px]" />
      </StoryCase>

      <StoryCase title="文本卡" description="预览、空白、长正文和着色。双击进入编辑，失焦提交。">
        <InteractiveGraph document={textCardsDocument} height="h-[400px]" />
      </StoryCase>

      <StoryCase title="组" description="含成员的命名组、未命名组、长名称着色组。双击组名可编辑。">
        <InteractiveGraph document={groupCardsDocument} height="h-[320px]" />
      </StoryCase>

      <StoryCase
        title="画布引用卡"
        description="内嵌预览、仅标题、目标已删除、着色。双击打开由上层处理。"
      >
        <InteractiveGraph document={canvasRefCardsDocument} height="h-[420px]" />
      </StoryCase>
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

export const CanvasCardsStory: Story = {
  name: "Canvas Cards",
  render: () => <CanvasCardsShowcase />,
};
