import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { CanvasSearchOverlay, type CanvasSearchIndexItem } from "./canvas-search-overlay";
import { typicalSearchIndex } from "./canvas-story-fixtures";

function SearchStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[320px] w-full max-w-[720px] overflow-hidden rounded-lg border bg-muted/30">
      {children}
    </div>
  );
}

function SearchDemo({
  index = typicalSearchIndex,
  onSelect,
}: {
  index?: CanvasSearchIndexItem[];
  onSelect?: (id: string) => void;
}) {
  const [selected, setSelected] = useState("尚未选择");
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <div className="grid gap-2">
        <SearchStage>
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            已关闭
          </div>
        </SearchStage>
        <p className="text-xs text-muted-foreground">{selected}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <SearchStage>
        <CanvasSearchOverlay
          index={index}
          onSelect={(id) => {
            setSelected(`选中：${id}`);
            onSelect?.(id);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      </SearchStage>
      <p className="text-xs text-muted-foreground">
        {selected}。输入后用方向键移动，Enter 选中，Esc 关闭。
      </p>
    </div>
  );
}

function CanvasSearchShowcase() {
  return (
    <StoryShowcase
      title="Canvas Search"
      description="验收画布内搜索浮层的输入、类型标记、空匹配、长标题截断和键盘选择。打开后可直接输入操作。"
    >
      <StoryCase
        title="输入与键盘"
        description="输入「夜」或「压力」查看命中。方向键改变当前项，Enter 选中并关闭，Esc 关闭。"
      >
        <SearchDemo />
      </StoryCase>

      <StoryCase
        title="各类命中"
        description="理解、文本、组、画布引用、连线共用同一结果行，靠类型标记区分。"
      >
        <SearchDemo />
      </StoryCase>

      <StoryCase
        title="无匹配"
        description="索引里没有与查询相关的条目时显示空状态。打开后输入任意不存在的词即可看到；下面同时放一份只含无关条目的索引便于对照。"
      >
        <SearchDemo index={[{ id: "other", kind: "text", text: "与灌溉无关的临时笔记" }]} />
      </StoryCase>

      <StoryCase title="长标题截断" description="超长主文本在 320px 浮层宽度内单行截断。">
        <SearchDemo
          index={[
            {
              id: "el-long",
              kind: "understanding",
              text: "这是一个非常长的理解标题，用来观察搜索结果在固定宽度下是否正确截断并且不撑破布局",
            },
            { id: "el-note", kind: "text", text: "主管压力" },
          ]}
        />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Canvas/基本组件",
  component: CanvasSearchOverlay,
  parameters: {
    layout: "padded",
  },
  args: {
    index: typicalSearchIndex,
    onSelect: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof CanvasSearchOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanvasSearchStory: Story = {
  name: "Canvas Search",
  render: () => <CanvasSearchShowcase />,
};
