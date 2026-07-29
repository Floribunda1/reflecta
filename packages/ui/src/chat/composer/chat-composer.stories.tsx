import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ChatComposer,
  createChatComposerDocument,
  type ChatComposerAttachmentAdapter,
  type ChatComposerEntitySearch,
  type ChatComposerProps,
} from "..";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";

const models = [
  {
    id: "openai:gpt",
    label: "GPT-5.2",
    providerLabel: "OpenAI",
    reasoningOptions: [
      { id: "off", label: "关闭推理" },
      { id: "medium", label: "中推理" },
      { id: "high", label: "高推理" },
    ],
  },
  {
    id: "anthropic:claude",
    label: "Claude Sonnet 4.5",
    providerLabel: "Anthropic",
    reasoningOptions: [{ id: "off", label: "关闭推理" }],
  },
];

const searchEntities: ChatComposerEntitySearch = async (query, signal) => {
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  if (signal.aborted) return [];
  if (query.includes("错误")) throw new Error("模拟搜索失败");
  if (query.includes("空")) return [];
  const options = [
    {
      type: "understanding" as const,
      id: "understanding-1",
      label: "组件边界",
      subtitle: "展示语义属于 UI package，业务编排留在 Adapter。",
    },
    {
      type: "context" as const,
      id: "context-1",
      label: "Storybook 验收",
      subtitle: "覆盖 streaming、确认、拒绝与失败状态。",
    },
    {
      type: "domain" as const,
      id: "domain-1",
      label: "UI 架构",
      subtitle: "技术 / UI 架构",
    },
  ];
  const normalized = query.trim().toLowerCase();
  return normalized
    ? options.filter((option) => option.label.toLowerCase().includes(normalized))
    : options;
};

const attachmentAdapter: ChatComposerAttachmentAdapter = {
  async addFiles(files, signal) {
    if (signal.aborted) return [];
    if (files.some((file) => file.name.includes("失败"))) {
      throw new Error("模拟附件上传失败");
    }
    return files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      size: file.size,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
  },
};

const baseComposerProps: ChatComposerProps = {
  draftId: "storybook-draft",
  status: "idle",
  canStop: true,
  modelOptions: models,
  selectedModelId: "openai:gpt",
  selectedReasoningId: "medium",
  contextUsage: {
    percent: 36,
    label: "36%",
    description: "当前上下文：46.1K / 128K",
  },
  searchEntities,
  attachmentAdapter,
  onSubmit: async () => undefined,
};

function ComposerDemo({ draftId, ...overrides }: Partial<ChatComposerProps> & { draftId: string }) {
  return <ChatComposer {...baseComposerProps} {...overrides} draftId={draftId} />;
}

function ComposerShowcase() {
  return (
    <StoryShowcase
      title="Composer"
      description="在一个页面内验收空白、Entity、历史编辑、运行、上下文压缩、附件联想和危险边界。每个输入框使用独立 draft identity。"
    >
      <StoryCase title="空白输入" description="默认模型、推理等级和上下文用量。">
        <ComposerDemo draftId="showcase-empty" />
      </StoryCase>
      <StoryCase title="初始 Entity" description="初始化时已经携带 Understanding 引用。">
        <ComposerDemo
          draftId="showcase-entity"
          initialEntities={[
            {
              type: "understanding",
              id: "understanding-1",
              label: "组件边界",
            },
          ]}
        />
      </StoryCase>
      <StoryCase title="编辑历史消息" description="编辑态需要恢复文本和稳定的 Entity 节点。">
        <ComposerDemo
          draftId="showcase-edit"
          editingMessageId="user-message-1"
          initialValue={{
            text: "请比较这两种组件边界。",
            document: createChatComposerDocument("请比较这两种组件边界。", [
              {
                type: "understanding",
                id: "understanding-1",
                label: "组件边界",
              },
            ]),
            entities: [
              {
                type: "understanding",
                id: "understanding-1",
                label: "组件边界",
              },
            ],
            attachments: [],
          }}
        />
      </StoryCase>
      <StoryCase title="运行与停止" description="发送入口切换为停止操作。">
        <ComposerDemo draftId="showcase-running" status="running" />
      </StoryCase>
      <StoryCase title="压缩上下文" description="压缩期间输入不可提交，也不能停止。">
        <ComposerDemo draftId="showcase-compacting" status="compacting" canStop={false} />
      </StoryCase>
      <StoryCase
        title="附件与 Entity 联想"
        description="包含图片、长文件名；输入 @ 可验收 Entity 搜索。"
      >
        <ComposerDemo
          draftId="showcase-attachments"
          initialValue={{
            text: "请结合附件和引用检查这次 UI 调整。",
            document: createChatComposerDocument("请结合附件和引用检查这次 UI 调整。"),
            entities: [],
            attachments: [
              {
                id: "attachment-image",
                name: "agent-streaming-layout.png",
                mediaType: "image/png",
                previewUrl:
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='100'%3E%3Crect width='100%25' height='100%25' fill='%23dbeafe'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%231e3a8a'%3EUI%3C/text%3E%3C/svg%3E",
              },
              {
                id: "attachment-document",
                name: "storybook-验收说明-包含一个很长的文件名.pdf",
                mediaType: "application/pdf",
                size: 480_000,
              },
            ],
          }}
        />
      </StoryCase>
      <StoryCase
        title="长输入、大量模型与高上下文"
        description="窄容器、高上下文占用和长模型名称不能破坏布局。"
        className="xl:col-span-2"
      >
        <div className="w-[360px] max-w-full">
          <ComposerDemo
            draftId="showcase-boundaries"
            initialValue={{
              text: "请检查这个非常长的输入在窄容器中是否仍然保持稳定布局。".repeat(8),
              document: createChatComposerDocument(
                "请检查这个非常长的输入在窄容器中是否仍然保持稳定布局。".repeat(8),
              ),
              entities: [],
              attachments: [],
            }}
            modelOptions={[
              ...models,
              ...Array.from({ length: 12 }, (_, index) => ({
                id: `local:model-${index}`,
                label: `本地测试模型 ${index + 1} · 一个较长的模型名称`,
                providerLabel: "Local",
                reasoningOptions: [
                  { id: "off", label: "关闭推理" },
                  { id: "high", label: "高推理" },
                ],
              })),
            ]}
            contextUsage={{
              percent: 96,
              label: "96%",
              description: "当前上下文：122.8K / 128K",
            }}
          />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: ChatComposer,
  args: baseComposerProps,
} satisfies Meta<typeof ChatComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ComposerStory: Story = {
  name: "Composer",
  render: () => <ComposerShowcase />,
};
