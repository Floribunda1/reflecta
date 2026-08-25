import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { MarkdownEditor, MarkdownPreview } from "../editor";
import { SimpleMarkdownPreview } from "../editor/simple-markdown-preview";
import { useDrawer } from "../overlays";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { denseDomains, resolveStoryWikiLink, typicalDomains } from "./capture-story-fixtures";
import {
  UnderstandingCanvasMembership,
  UnderstandingDetailHeader,
  UnderstandingDetailLayout,
  type UnderstandingDetailCanvasView,
  type UnderstandingDetailContextView,
} from "./understanding-detail";
import { DomainTreeSelect } from "./domain-tree-select";

const typicalContexts: UnderstandingDetailContextView[] = [
  {
    id: "context-next",
    medium: "article",
    title: "github.com/vercel/next.js",
    content:
      "Next.js App Router 的实现细节说明了 layout.tsx 如何承接嵌套路由，也让我重新区分了服务端渲染与 hydration。",
  },
  {
    id: "context-project",
    medium: "experience",
    title: "一次首屏性能排查",
    content: "把只参与首屏展示的数据读取移到服务端后，客户端 bundle 明显缩小。",
  },
];

const typicalCanvases: UnderstandingDetailCanvasView[] = [
  { id: "canvas-react", title: "React 渲染模型" },
];

const denseContexts: UnderstandingDetailContextView[] = [
  ...typicalContexts,
  { id: "context-video", medium: "video", title: "RSC 工作原理", content: "视频复盘。" },
  { id: "context-book", medium: "book", title: "React 架构笔记", content: "章节摘记。" },
  { id: "context-opinion", medium: "opinion", title: "代码评审中的反例", content: "同事的判断。" },
  { id: "context-ai", medium: "ai", title: "与 AI 的边界讨论", content: "仍待验证。" },
  { id: "context-other", medium: "other", title: null, content: "" },
];

const denseCanvases: UnderstandingDetailCanvasView[] = Array.from({ length: 6 }, (_, index) => ({
  id: `canvas-${index}`,
  title:
    index === 0
      ? "一张名称非常长的 React 服务端渲染、流式输出与客户端交互边界画布"
      : `React 研究画布 ${index + 1}`,
}));

type DetailFixture = {
  title: string;
  body: string;
  domainIds: string[];
  contexts: UnderstandingDetailContextView[];
  canvases: UnderstandingDetailCanvasView[];
  domains: typeof typicalDomains;
  widthClassName?: string;
};

const fixtures: Record<"typical" | "empty" | "dense", DetailFixture> = {
  typical: {
    title: "React Server Components",
    body: "RSC allows server-side rendering of components without shipping JS to client.\n\nCould be combined with [[u:understanding-irrigation]] for progressive hydration.",
    domainIds: ["technology", "research"],
    contexts: typicalContexts,
    canvases: typicalCanvases,
    domains: typicalDomains,
  },
  empty: {
    title: "",
    body: "",
    domainIds: [],
    contexts: [],
    canvases: [],
    domains: typicalDomains,
  },
  dense: {
    title: "React Server Components、Streaming 与客户端交互边界的长期观察",
    body: `# 当前判断

服务端组件减少了发送到客户端的 JavaScript，但并不自动消除交互复杂度。

- 数据读取的位置决定 bundle 边界
- Suspense 决定流式呈现节奏
- Client Component 仍然承担浏览器交互

这个判断需要继续结合真实项目中的性能数据验证。`,
    domainIds: ["night-shift", "dense-domain-1"],
    contexts: denseContexts,
    canvases: denseCanvases,
    domains: denseDomains,
    widthClassName: "max-w-3xl",
  },
};

function UnderstandingDetailDemo({ fixtureName }: { fixtureName: keyof typeof fixtures }) {
  const fixture = fixtures[fixtureName];
  const [title, setTitle] = useState(fixture.title);
  const [body, setBody] = useState(fixture.body);
  const [domainIds, setDomainIds] = useState(fixture.domainIds);
  const [contexts, setContexts] = useState(fixture.contexts);
  const [focusMode, setFocusMode] = useState(false);
  const [lastAction, setLastAction] = useState("可以直接操作标题、领域、上下文和画布入口。");
  const { openDrawer } = useDrawer();

  const previewContext = (context: UnderstandingDetailContextView) => {
    setLastAction(`查看上下文：${context.title || "其他"}`);
    openDrawer(
      { title: "上下文预览" },
      <MarkdownPreview value={context.content || "空上下文。"} />,
    );
  };

  return (
    <div className={fixture.widthClassName}>
      <div className="h-[720px] overflow-hidden rounded-xl border bg-background">
        <UnderstandingDetailLayout
          header={
            <UnderstandingDetailHeader
              title={title}
              updatedLabel="不到 1 分钟前"
              focusMode={focusMode}
              onFocusModeChange={setFocusMode}
              onChat={() => setLastAction("打开理解对话")}
              onClose={() => setLastAction("关闭详情")}
              onDelete={() => setLastAction("请求删除理解")}
              onTitleChange={setTitle}
              onTitleBlur={() => setLastAction("保存标题")}
            />
          }
          body={
            <MarkdownEditor
              documentId={`storybook-${fixtureName}`}
              value={body}
              height="auto"
              maxHeight="clamp(240px, 45vh, 440px)"
              placeholder="用自己的语言写下这条理解。输入 [[ 连接相关理解。"
              resolveWikiLink={resolveStoryWikiLink}
              onChange={setBody}
            />
          }
          metadata={
            <DomainTreeSelect
              value={domainIds}
              onValueChange={setDomainIds}
              nodes={fixture.domains}
              placeholder="未归入 Domain"
              fluid={false}
              showPath={false}
              variant="inline"
            />
          }
          contexts={contexts}
          canvasMembership={
            <UnderstandingCanvasMembership
              canvases={fixture.canvases}
              onOpen={(canvasId) => setLastAction(`打开画布：${canvasId}`)}
            />
          }
          focusMode={focusMode}
          onAddContext={() => {
            setContexts((current) => [
              ...current,
              {
                id: `context-${current.length + 1}`,
                medium: "experience",
                title: "新上下文",
                content: "从这里继续补充具体经历。",
              },
            ]);
            setLastAction("添加上下文");
          }}
          onPreviewContext={previewContext}
          onEditContext={(context) => {
            setContexts((current) =>
              current.map((item) =>
                item.id === context.id
                  ? { ...item, title: `${item.title || "上下文"}（已编辑）` }
                  : item,
              ),
            );
            setLastAction(`编辑上下文：${context.title || "其他"}`);
          }}
          onDeleteContext={(context) => {
            setContexts((current) => current.filter((item) => item.id !== context.id));
            setLastAction(`删除上下文：${context.title || "其他"}`);
          }}
          renderMarkdown={(props) => (
            <SimpleMarkdownPreview {...props} resolveWikiLink={resolveStoryWikiLink} />
          )}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        {lastAction}
      </p>
    </div>
  );
}

function UnderstandingDetailShowcase() {
  return (
    <StoryShowcase
      title="理解详情面板"
      description="验收连续阅读层级、上下文显式操作、画布导航与专注模式。"
    >
      <StoryCase title="典型内容" description="正文、上下文和关联画布齐全；所有入口均可操作。">
        <UnderstandingDetailDemo fixtureName="typical" />
      </StoryCase>
      <StoryCase title="空内容" description="标题、正文、上下文和画布关系均为空。">
        <UnderstandingDetailDemo fixtureName="empty" />
      </StoryCase>
      <StoryCase
        title="高密度与窄面板"
        description="长标题、全部上下文媒介、多画布关系和窄内容区同时出现。"
      >
        <UnderstandingDetailDemo fixtureName="dense" />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/组合场景样式",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderstandingDetailStory: Story = {
  name: "理解详情面板",
  render: () => <UnderstandingDetailShowcase />,
};
