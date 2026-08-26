import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { Button } from "../components/button";
import { CanvasSearchOverlay, type CanvasSearchIndexItem } from "./canvas-search-overlay";
import { typicalSearchIndex } from "./canvas-story-fixtures";

function SearchDemo({
  index = typicalSearchIndex,
  onSelect,
}: {
  index?: CanvasSearchIndexItem[];
  onSelect?: (id: string) => void;
}) {
  const [selected, setSelected] = useState("尚未选择");
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        打开搜索
      </Button>
      {open ? (
        <CanvasSearchOverlay
          index={index}
          onSelect={(id) => {
            setSelected(`选中：${id}`);
            onSelect?.(id);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        {selected}。打开后可直接输入，方向键移动，Enter 选中，Esc 关闭。
      </p>
    </div>
  );
}

function CanvasSearchShowcase() {
  return (
    <StoryShowcase
      title="Canvas Search"
      description="验收画布搜索 Command Dialog 的输入、类型标记、空匹配、长标题截断和键盘选择。每个案例点「打开搜索」后操作。"
    >
      <StoryCase
        title="输入与键盘"
        description="输入「夜」或「压力」查看命中。方向键改变当前项，Enter 选中并关闭，Esc 关闭。"
      >
        <SearchDemo />
      </StoryCase>

      <StoryCase
        title="各类命中"
        description="理解、文本、组、画布引用、连线共用同一结果行，靠左侧图标区分类型。"
      >
        <SearchDemo />
      </StoryCase>

      <StoryCase
        title="无匹配"
        description="打开后输入任意不存在的词即可看到空状态；下面这份索引只含无关条目，便于对照。"
      >
        <SearchDemo index={[{ id: "other", kind: "text", text: "与灌溉无关的临时笔记" }]} />
      </StoryCase>

      <StoryCase title="长标题截断" description="超长主文本在 Dialog 宽度内单行截断。">
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
