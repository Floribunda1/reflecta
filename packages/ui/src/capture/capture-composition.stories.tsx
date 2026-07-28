import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { MarkdownEditor } from "../editor";
import { DomainTree, type DomainTreeNodeView } from "./domain-tree";
import { UnderstandingRow, type UnderstandingRowView } from "./understanding-row";

const domains: DomainTreeNodeView[] = [
  {
    id: "technology",
    name: "技术",
    children: [
      {
        id: "ui",
        name: "UI 架构",
        children: [{ id: "storybook", name: "Storybook 组件验收", children: [] }],
      },
      { id: "server", name: "Server 架构", children: [] },
    ],
  },
  { id: "product", name: "产品与用户价值", children: [] },
];

const understandings: UnderstandingRowView[] = [
  {
    id: "acceptance",
    title: "Storybook 只验收高价值组件",
    body: "标准表单、普通列表和详情的 ROI 较低，不单独建立 Story。",
    updatedLabel: "12 分钟前",
    contextCount: 4,
    connectionCount: 7,
  },
  {
    id: "streaming",
    title: "Streaming 必须保持稳定 Identity",
    body: "Tool root、item、Message 和 Proposal ID 在逐帧更新中保持不变。",
    updatedLabel: "1 小时前",
    contextCount: 2,
    connectionCount: 5,
  },
  {
    id: "seam",
    title: "UI-owned interface 不依赖 Renderer runtime",
    body: "query、store、IPC 和 mutation 由 Adapter 持有。",
    updatedLabel: "昨天",
    contextCount: 3,
    connectionCount: 9,
  },
];

function KnowledgeCaptureDemo() {
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>("storybook");
  const [expandedIds, setExpandedIds] = useState(["technology", "ui"]);
  const [selectedUnderstandingId, setSelectedUnderstandingId] = useState("acceptance");
  const [value, setValue] = useState(`# Storybook 只验收高价值组件

标准 primitives 组合出的普通表单、列表和详情不需要单独进入 Storybook。

## 准入条件

- 有项目独有的样式、交互或丰富状态；
- 独立展示可以发现真实回归；
- production seam 本身足够清晰。
`);

  return (
    <div className="grid min-h-[720px] grid-cols-[220px_300px_minmax(0,1fr)] overflow-hidden rounded-xl border bg-background shadow-sm">
      <aside className="min-w-0 border-r p-3">
        <div className="mb-3 px-2 text-sm font-medium">领域</div>
        <DomainTree
          nodes={domains}
          selectedId={selectedDomainId}
          expandedIds={expandedIds}
          onSelect={setSelectedDomainId}
          onToggle={(id) =>
            setExpandedIds((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
          onAction={() => undefined}
        />
      </aside>

      <section className="min-w-0 border-r p-3">
        <div className="mb-3 flex items-center justify-between gap-2 px-2">
          <span className="truncate text-sm font-medium">Storybook 组件验收</span>
          <span className="shrink-0 text-xs text-muted-foreground">3 条理解</span>
        </div>
        <div className="grid gap-1">
          {understandings.map((item) => (
            <UnderstandingRow
              key={item.id}
              understanding={item}
              selected={selectedUnderstandingId === item.id}
              onSelect={setSelectedUnderstandingId}
              onAction={() => undefined}
            />
          ))}
        </div>
      </section>

      <main className="min-w-0 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            {understandings.find((item) => item.id === selectedUnderstandingId)?.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            观察树、列表行和编辑器同时出现时的信息层级
          </p>
        </div>
        <MarkdownEditor
          documentId={selectedUnderstandingId}
          value={value}
          height={560}
          onChange={setValue}
        />
      </main>
    </div>
  );
}

const meta = {
  title: "Capture/组合场景样式",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const KnowledgeCapture: Story = {
  name: "知识整理核心组合",
  render: () => <KnowledgeCaptureDemo />,
};
