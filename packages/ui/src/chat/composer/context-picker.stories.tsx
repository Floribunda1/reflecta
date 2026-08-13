import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import type { ChatComposerEntityOption } from "../entity";
import { entityKey } from "../entity-visual";
import { ChatContextPicker, ChatSkillPicker } from "./context-picker";

const entityOptions: ChatComposerEntityOption[] = [
  {
    type: "understanding",
    id: "understanding-1",
    label: "组件边界",
    subtitle: "展示语义属于 UI package，业务编排留在 Adapter。",
  },
  {
    type: "understanding",
    id: "understanding-2",
    label: "Streaming 稳定 Identity",
    subtitle: "流式更新必须保持消息与 block id 不变。",
  },
  {
    type: "context",
    id: "context-1",
    label: "Storybook 验收",
    subtitle: "覆盖 streaming、确认、拒绝与失败状态。",
  },
  {
    type: "context",
    id: "context-2",
    label: "上下文压缩",
    subtitle: "较长时间段内的摘要与 Token 变化。",
  },
  {
    type: "domain",
    id: "domain-1",
    label: "UI 架构",
    subtitle: "技术 / UI 架构",
  },
  {
    type: "domain",
    id: "domain-2",
    label: "实践与复盘",
    subtitle: "项目复盘记录",
  },
];

const skills = [
  { name: "explain-note", description: "把当前笔记解释成清晰、可验证的结论。" },
  { name: "release-check", description: "检查版本发布前的必要步骤。" },
  { name: "draft-proposal", description: "生成知识变更提案并进入审批。" },
];

function PickerDemo({
  state,
  options = entityOptions,
}: {
  state: "idle" | "loading" | "ready" | "empty" | "error";
  options?: readonly ChatComposerEntityOption[];
}) {
  const [activeId, setActiveId] = useState<string | undefined>("context-1");
  return (
    <ChatContextPicker
      state={state}
      options={options}
      activeId={activeId}
      onSelect={(option) => setActiveId(entityKey(option))}
      onCancel={() => setActiveId(undefined)}
    />
  );
}

function ContextPickerShowcase() {
  return (
    <StoryShowcase
      title="Context Picker"
      description="验收 @ 实体选择器的类型图谱、候选生命周期（loading/ready/empty/error）与键盘选中反馈。"
    >
      <StoryCase
        title="实体类型图谱"
        description="Understanding / Context / Domain 三类候选共用行结构，图标与副标题区分类型。"
      >
        <div className="w-96 max-w-full">
          <PickerDemo state="ready" />
        </div>
      </StoryCase>

      <StoryCase
        title="候选生命周期"
        description="loading、ready、empty 与 error 在同一位置并排比较，空态文案区分失败与无结果。"
      >
        <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-4">
          <PickerDemo state="loading" options={[]} />
          <PickerDemo state="ready" />
          <PickerDemo state="empty" options={[]} />
          <PickerDemo state="error" options={[]} />
        </div>
      </StoryCase>

      <StoryCase
        title="选中与键盘"
        description="点击切换 active 项（高亮 + 滚动到可见区），Escape 取消当前选中。"
      >
        <div className="w-96 max-w-full">
          <PickerDemo state="ready" />
        </div>
      </StoryCase>

      <StoryCase title="Skill 列表" description="$ Skill 联想的名称与描述列表。">
        <div className="w-96 max-w-full">
          <ChatSkillPicker
            options={skills}
            activeName="explain-note"
            onSelect={() => undefined}
            onCancel={() => undefined}
          />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: ChatContextPicker,
  args: {
    state: "ready",
    options: entityOptions,
    onSelect: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof ChatContextPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContextPickerStory: Story = {
  name: "Context Picker",
  render: () => <ContextPickerShowcase />,
};
