import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  MarkdownEditor,
  MarkdownPreview,
  SimpleMarkdownPreview,
  type MarkdownEditorProps,
  type MarkdownEditorSuggestionSource,
} from ".";

const richDocument = `# Markdown Editor

Write with **bold**, _emphasis_, lists, tables, code, and wiki links.

- Capture an idea
- Connect [[Project Alpha#understanding-alpha]]

| Module | Status |
| --- | --- |
| Editor | Migrated |

\`\`\`ts
const packageName = "@reflecta/ui";
\`\`\`
`;

const getSuggestions: MarkdownEditorSuggestionSource = async (query, signal) => {
  if (signal.aborted) return [];
  const items = [
    {
      id: "understanding-alpha",
      label: "Project Alpha",
      preview: "A connected understanding from an in-memory Storybook adapter.",
      markdown: "[[Project Alpha#understanding-alpha]]",
    },
    {
      id: "understanding-beta",
      label: "Design system",
      preview: "Shared tokens and reusable product UI.",
      markdown: "[[Design system#understanding-beta]]",
    },
  ];
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedQuery
    ? items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : items;
};

function ControlledEditor(
  props: Omit<MarkdownEditorProps, "value" | "onChange"> & {
    initialValue: string;
  },
) {
  const { initialValue, ...editorProps } = props;
  const [value, setValue] = useState(initialValue);
  return <MarkdownEditor {...editorProps} value={value} onChange={setValue} />;
}

const meta = {
  title: "Editor/Markdown Editor",
  component: MarkdownEditor,
  args: {
    value: richDocument,
    height: 420,
  },
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RichContent: Story = {
  render: (args) => (
    <ControlledEditor
      documentId="storybook-rich"
      initialValue={args.value}
      height={args.height}
      maxHeight={args.maxHeight}
      placeholder={args.placeholder}
      getSuggestions={getSuggestions}
      uploadAsset={async (file) => ({
        url: URL.createObjectURL(file),
        alt: file.name,
      })}
    />
  ),
};

export const Empty: Story = {
  args: {
    value: "",
    placeholder: "Capture a thought…",
  },
  render: (args) => (
    <ControlledEditor
      documentId="storybook-empty"
      initialValue={args.value}
      height={320}
      placeholder={args.placeholder}
      getSuggestions={getSuggestions}
    />
  ),
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
  },
};

export const Previews: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-8">
      <MarkdownPreview value={richDocument} zoomImages={false} />
      <div className="rounded-lg border p-4">
        <SimpleMarkdownPreview value={richDocument} lineClamp={3} />
      </div>
    </div>
  ),
};
