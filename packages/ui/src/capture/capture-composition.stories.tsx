import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { MarkdownEditor, MarkdownPreview } from "../editor";
import { markdownBoundaryDocument } from "../editor/markdown-story-fixtures";
import { DomainTree, type DomainTreeNodeView } from "./domain-tree";
import { UnderstandingRow, type UnderstandingRowView } from "./understanding-row";

const typicalDomains: DomainTreeNodeView[] = [
  {
    id: "technology",
    name: "技术",
    children: [
      {
        id: "ui",
        name: "UI 架构",
        children: [{ id: "storybook", name: "Storybook 组件验收", children: [] }],
      },
      { id: "server", name: "Server 与数据持久化", children: [] },
    ],
  },
  { id: "product", name: "产品与用户价值", children: [] },
];

const typicalUnderstandings: UnderstandingRowView[] = [
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

const denseDomains: DomainTreeNodeView[] = [
  {
    id: "engineering",
    name: "设施工程与极端环境长期运行策略",
    children: [
      {
        id: "greenhouse",
        name: "极地温室",
        children: [
          {
            id: "irrigation",
            name: "低温条件下的分区灌溉与压力稳定",
            children: [
              {
                id: "night-shift",
                name: "夜班联调、异常复验与下一观察窗",
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `dense-domain-${index}`,
    name: `第 ${index + 1} 个模拟领域：用于观察大量顶级节点下的滚动`,
    children: [],
  })),
];

const denseUnderstandings: UnderstandingRowView[] = Array.from({ length: 12 }, (_, index) => ({
  id: `dense-understanding-${index}`,
  title:
    index === 0
      ? "这是一个非常长的 Understanding 标题，用于同时观察标题、更新时间和选中状态的截断"
      : `模拟理解 ${index + 1}：极地温室第 ${(index % 4) + 1} 轮复验记录`,
  body:
    index % 3 === 0
      ? "这段 **Markdown** 摘要包含较长的中文内容、[链接](https://example.com/a/very/long/path) 和 `inlineCodeWithoutNaturalBreakPoint`，用于观察窄列中的两行截断。"
      : "分区灌溉需要同时观察入口温度、主管压力和支路阀门实际开度。",
  updatedLabel: index === 0 ? "大约 1 年前" : `${index + 2} 小时前`,
  contextCount: index * 3,
  connectionCount: index * 5,
}));

const typicalDocument = `# Storybook 组件验收

标准 primitives 组合出的普通表单、列表和详情不需要单独进入 Storybook。

## 准入条件

- 有项目独有的样式、交互或丰富状态；
- 独立展示可以发现真实回归；
- production seam 本身足够清晰。`;

function CaptureWorkspace({
  domains,
  understandings,
  initialDomainId,
  initialUnderstandingId,
  dense = false,
}: {
  domains: DomainTreeNodeView[];
  understandings: UnderstandingRowView[];
  initialDomainId: string;
  initialUnderstandingId: string;
  dense?: boolean;
}) {
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(initialDomainId);
  const [expandedIds, setExpandedIds] = useState(
    dense ? ["engineering", "greenhouse", "irrigation"] : ["technology", "ui"],
  );
  const [selectedUnderstandingId, setSelectedUnderstandingId] = useState(initialUnderstandingId);
  const [value, setValue] = useState(typicalDocument);

  return (
    <div
      className={
        dense
          ? "grid h-[680px] min-w-0 grid-cols-[180px_240px_minmax(0,1fr)] overflow-hidden rounded-xl border bg-background"
          : "grid h-[680px] min-w-0 grid-cols-[240px_320px_minmax(0,1fr)] overflow-hidden rounded-xl border bg-background"
      }
    >
      <aside className="min-w-0 overflow-auto border-r p-3">
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

      <section className="min-w-0 overflow-auto border-r p-3">
        <div className="mb-3 flex items-center justify-between gap-2 px-2">
          <span className="truncate text-sm font-medium">
            {dense ? "分区灌溉与压力稳定" : "Storybook 组件验收"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{understandings.length} 条</span>
        </div>
        <div className="grid gap-1">
          {understandings.map((understanding) => (
            <UnderstandingRow
              key={understanding.id}
              understanding={understanding}
              selected={selectedUnderstandingId === understanding.id}
              onSelect={setSelectedUnderstandingId}
              onAction={() => undefined}
            />
          ))}
        </div>
      </section>

      <main className="min-w-0 overflow-auto p-5">
        {dense ? (
          <MarkdownPreview value={markdownBoundaryDocument} />
        ) : (
          <MarkdownEditor
            documentId={selectedUnderstandingId}
            value={value}
            height={590}
            onChange={setValue}
          />
        )}
      </main>
    </div>
  );
}

function CaptureCompositionShowcase() {
  return (
    <StoryShowcase
      title="Capture 组合场景"
      description="只观察 Domain Tree、Understanding Row 与 Markdown 内容区相邻时的层级、选择和密度。"
    >
      <StoryCase title="典型知识整理" description="树、理解列表和编辑器在常见桌面宽度下共同工作。">
        <CaptureWorkspace
          domains={typicalDomains}
          understandings={typicalUnderstandings}
          initialDomainId="storybook"
          initialUnderstandingId="acceptance"
        />
      </StoryCase>
      <StoryCase
        title="高密度边界"
        description="深层领域、长标题、长摘要、大量列表项和复杂只读正文同时压入窄列。"
      >
        <div className="max-w-[980px] overflow-auto">
          <CaptureWorkspace
            dense
            domains={denseDomains}
            understandings={denseUnderstandings}
            initialDomainId="night-shift"
            initialUnderstandingId="dense-understanding-0"
          />
        </div>
      </StoryCase>
    </StoryShowcase>
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

export const CompositionStory: Story = {
  name: "知识整理核心组合",
  render: () => <CaptureCompositionShowcase />,
};
