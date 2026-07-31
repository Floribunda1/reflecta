import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { fullMarkdownStoryDocument, markdownBoundaryDocument } from "./markdown-story-fixtures";
import { MarkdownPreview } from "./markdown-preview";

const imageDocument = `## 图片缩放

![横向控制台](data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='260'%3E%3Crect width='100%25' height='100%25' fill='%23dbeafe'/%3E%3Cpath d='M80 190 L190 80 L280 160 L390 55 L620 210' fill='none' stroke='%232563eb' stroke-width='12'/%3E%3Ctext x='44' y='44' fill='%231e3a8a' font-size='24'%3E灌溉趋势%3C/text%3E%3C/svg%3E)

![竖向现场记录](data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='520'%3E%3Crect width='100%25' height='100%25' fill='%23dcfce7'/%3E%3Ccircle cx='160' cy='180' r='90' fill='%2386efac'/%3E%3Ctext x='58' y='380' fill='%23166534' font-size='24'%3E现场复核记录%3C/text%3E%3C/svg%3E)
`;

function WikiLinkPreview() {
  const [opened, setOpened] = useState("尚未打开 Wiki Link");
  return (
    <div className="grid gap-3">
      <MarkdownPreview
        value={`## 关联内容

可以继续查看 [[u:understanding-irrigation]]，也可以打开 [[u:understanding-long-title]]。`}
        onWikiLinkOpen={(reference) => setOpened(`已打开：${reference.type}:${reference.id}`)}
      />
      <p className="text-xs text-muted-foreground">{opened}</p>
    </div>
  );
}

function MarkdownPreviewShowcase() {
  return (
    <StoryShowcase
      title="Markdown Preview"
      description="验收完整只读正文的排版、Wiki Link、图片缩放、空内容和复杂几何边界。"
    >
      <StoryCase
        title="完整正文"
        description="完整语法放在固定高度内，便于集中检查标题、列表、引用、表格、代码和扩展结构。"
      >
        <div className="max-h-[720px] overflow-y-auto rounded-lg border p-5">
          <MarkdownPreview value={fullMarkdownStoryDocument} />
        </div>
      </StoryCase>

      <StoryCase title="Wiki Link" description="链接可打开，长标签保持换行和完整点击区域。">
        <WikiLinkPreview />
      </StoryCase>

      <StoryCase title="图片" description="并排比较开启和关闭 zoom；开启时可点击图片放大。">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">允许缩放</span>
            <MarkdownPreview value={imageDocument} />
          </div>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">禁止缩放</span>
            <MarkdownPreview value={imageDocument} zoomImages={false} />
          </div>
        </div>
      </StoryCase>

      <StoryCase title="空与最小正文">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-h-32 rounded-lg border p-4">
            <span className="text-xs text-muted-foreground">空字符串</span>
            <MarkdownPreview value="" />
          </div>
          <div className="min-h-32 rounded-lg border p-4">
            <MarkdownPreview value="只有一段最小正文。" />
          </div>
        </div>
      </StoryCase>

      <StoryCase
        title="复杂内容与窄容器"
        description="宽表格、长代码、连续字符串和图片留在 360px 容器内。"
      >
        <div className="w-[360px] max-w-full rounded-lg border p-4">
          <MarkdownPreview value={markdownBoundaryDocument} zoomImages={false} />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/基本组件",
  component: MarkdownPreview,
  args: {
    value: fullMarkdownStoryDocument,
  },
} satisfies Meta<typeof MarkdownPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MarkdownPreviewStory: Story = {
  name: "Markdown Preview",
  render: () => <MarkdownPreviewShowcase />,
};
