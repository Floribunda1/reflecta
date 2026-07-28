import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ChatComposer,
  createChatComposerDocument,
  type ChatComposerAttachmentAdapter,
  type ChatComposerEntitySearch,
} from "..";

const models = [
  {
    id: "openai:gpt",
    label: "GPT",
    reasoningOptions: [
      { id: "off", label: "关闭推理" },
      { id: "medium", label: "中推理" },
      { id: "high", label: "高推理" },
    ],
  },
  {
    id: "anthropic:claude",
    label: "Claude",
    reasoningOptions: [{ id: "off", label: "关闭推理" }],
  },
];

const searchEntities: ChatComposerEntitySearch = async (query, signal) => {
  if (signal.aborted) return [];
  const options = [
    {
      type: "understanding" as const,
      id: "understanding-1",
      label: "Product direction",
      subtitle: "A durable understanding about the product.",
    },
    {
      type: "context" as const,
      id: "context-1",
      label: "Customer interview",
      subtitle: "Conversation notes from last week.",
    },
    {
      type: "domain" as const,
      id: "domain-1",
      label: "Reflecta",
      subtitle: "root domain",
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
    return files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      mediaType: file.type || "application/octet-stream",
      size: file.size,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
  },
};

const meta = {
  title: "Chat/Composer",
  component: ChatComposer,
  args: {
    draftId: "storybook-draft",
    status: "idle",
    canStop: true,
    modelOptions: models,
    selectedModelId: "openai:gpt",
    selectedReasoningId: "medium",
    contextUsage: {
      percent: 36,
      label: "36%",
      description: "上次上下文：46.1K / 128K",
    },
    searchEntities,
    attachmentAdapter,
    onSubmit: async () => undefined,
  },
} satisfies Meta<typeof ChatComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const InitialEntity: Story = {
  args: {
    initialEntities: [
      {
        type: "understanding",
        id: "understanding-1",
        label: "Product direction",
      },
    ],
  },
};

export const Editing: Story = {
  args: {
    draftId: "edit:user-message-1",
    editingMessageId: "user-message-1",
    initialValue: {
      text: "Can you compare these?",
      document: createChatComposerDocument("Can you compare these?", [
        {
          type: "understanding",
          id: "understanding-1",
          label: "Product direction",
        },
      ]),
      entities: [
        {
          type: "understanding",
          id: "understanding-1",
          label: "Product direction",
        },
      ],
      attachments: [],
    },
  },
};

export const Running: Story = {
  args: {
    status: "running",
  },
};

export const Compacting: Story = {
  args: {
    status: "compacting",
    canStop: false,
  },
};
