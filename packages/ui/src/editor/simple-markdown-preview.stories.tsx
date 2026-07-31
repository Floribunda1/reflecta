import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { SimpleMarkdownPreview } from "./markdown-preview";

const summaryDocument = `# 分区灌溉策略

温室按 **种植槽** 分配灌溉窗口，并结合 [回水温度](https://example.com/temperature) 与主管压力判断是否继续执行。

- 先开启旁通阀
- 再依次开启支路
- 异常时转入人工复核

关联 [[u:understanding-pressure-check]]。

> 单个峰值不作为最终结论。
`;

const longSummary =
  "这段 Markdown 摘要包含 **强调**、[链接](https://example.com) 和大量中英文内容，用来观察真实列表宽度下的多行截断。".repeat(
    8,
  );

function PreviewSample({
  label,
  value = summaryDocument,
  lineClamp,
  className,
}: {
  label: string;
  value?: string;
  lineClamp?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>
      <SimpleMarkdownPreview value={value} lineClamp={lineClamp} />
    </div>
  );
}

function SimpleMarkdownPreviewShowcase() {
  return (
    <StoryShowcase
      title="Markdown 摘要预览"
      description="验收紧凑 Markdown 渲染、行数限制、生产宽度和极端文本下的摘要可读性。"
    >
      <StoryCase
        title="紧凑 Markdown"
        description="保留标题、强调、列表和引用层级，链接与 Wiki Link 仅展示文本。"
      >
        <PreviewSample label="完整摘要文本" />
      </StoryCase>

      <StoryCase title="行数限制" description="同一份内容并排比较不限行、1 行、2 行和 3 行。">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <PreviewSample label="不限行" />
          <PreviewSample label="1 行" lineClamp={1} />
          <PreviewSample label="2 行" lineClamp={2} />
          <PreviewSample label="3 行" lineClamp={3} />
        </div>
      </StoryCase>

      <StoryCase title="生产宽度" description="列表行、详情摘要和弹性区域使用相同内容。">
        <div className="grid items-start gap-6 lg:grid-cols-[288px_420px_minmax(0,1fr)]">
          <PreviewSample
            label="Understanding Row · 288px"
            lineClamp={3}
            className="rounded-lg border p-3"
          />
          <PreviewSample
            label="详情摘要 · 420px"
            lineClamp={3}
            className="max-w-full rounded-lg border p-3"
          />
          <PreviewSample label="弹性区域" lineClamp={3} className="min-w-0 rounded-lg border p-3" />
        </div>
      </StoryCase>

      <StoryCase title="空内容与异常文本">
        <div className="grid gap-6 md:grid-cols-2">
          <PreviewSample
            label="空字符串"
            value=""
            lineClamp={2}
            className="rounded-lg border p-3"
          />
          <PreviewSample
            label="仅 Markdown 标记"
            value={"***\n\n---\n\n> #"}
            lineClamp={2}
            className="rounded-lg border p-3"
          />
          <PreviewSample
            label="连续英文"
            value={"reflecta-storybook-boundary-".repeat(16)}
            lineClamp={2}
            className="min-w-0 rounded-lg border p-3"
          />
          <PreviewSample
            label="中英文与 Emoji"
            value="灌溉策略 irrigation strategy 🌱 在低温窗口继续观察 pressure / temperature。"
            lineClamp={2}
            className="rounded-lg border p-3"
          />
        </div>
      </StoryCase>

      <StoryCase title="截断组合" description="长文本在选中行尺寸和窄容器中都不能越界。">
        <div className="grid gap-6 md:grid-cols-2">
          <PreviewSample
            label="标准列表宽度"
            value={longSummary}
            lineClamp={3}
            className="w-[420px] max-w-full rounded-lg border bg-muted/70 p-3"
          />
          <PreviewSample
            label="窄容器"
            value={longSummary}
            lineClamp={3}
            className="w-64 max-w-full rounded-lg border p-3"
          />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/基本组件",
  component: SimpleMarkdownPreview,
  args: {
    value: summaryDocument,
    lineClamp: 3,
  },
} satisfies Meta<typeof SimpleMarkdownPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SimpleMarkdownPreviewStory: Story = {
  name: "Markdown 摘要预览",
  render: () => <SimpleMarkdownPreviewShowcase />,
};
