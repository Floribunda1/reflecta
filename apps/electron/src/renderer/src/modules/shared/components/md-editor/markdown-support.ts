import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const allowedAdmonitionTypes = new Set(["note", "tip", "warning", "danger"]);
const wikiLinkPattern = /\[\[([^\]\n#]+)#([^\]\n#]+)\]\]/g;

export const ALL_MARKDOWN_FIXTURE = `# Markdown Fixture

Paragraph with **bold**, *italic*, ~~strike~~, \`inline code\`, [link](https://example.com), and [[Alpha#thought-1]].

## Lists

- Bullet item
- [x] Completed task
- [ ] Pending task

1. Ordered item
2. Ordered item

> Quote with **strong** text.

\`\`\`ts
const value = "code";
\`\`\`

\`\`\`mermaid
graph TD
  A[Input] --> B[Reflecta]
\`\`\`

---

| Concept | Status |
| --- | --- |
| GFM table | Ready |
| Editor parity | Check |

![demo image](asset:///demo-image.png)

<video src="asset:///demo-video.mp4" controls title="demo-video.mp4"></video>

:::warning
Admonition content with **nested markdown**.

- review render
:::
`;

export type PastedMedia = {
  filename: string;
  assetUrl: string;
  mimeType: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeMarkdownLabel(value: string): string {
  return value.replaceAll(/[[\]\\]/g, "\\$&").trim();
}

function collectText(node: any): string {
  if (!node) return "";
  if (node.type === "text" || node.type === "inlineCode") return String(node.value ?? "");
  if (node.type === "break") return "\n";
  if (!Array.isArray(node.children)) return "";
  return node.children.map(collectText).join("");
}

function createDefinitionListNode(lines: string[]) {
  const term = lines[0]?.trim();
  const definitions = lines
    .slice(1)
    .map((line) => /^:\s*(.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => match[1]?.trim())
    .filter(Boolean);

  if (!term || definitions.length === 0) return null;

  return {
    type: "definitionList",
    data: { hName: "dl" },
    children: [
      {
        type: "definitionTerm",
        data: { hName: "dt" },
        children: [{ type: "text", value: term }],
      },
      ...definitions.map((definition) => ({
        type: "definitionDescription",
        data: { hName: "dd" },
        children: [{ type: "text", value: definition }],
      })),
    ],
  };
}

export function normalizeAdmonitionType(value: unknown): string {
  const normalized = String(value ?? "note")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]/g, "");

  return allowedAdmonitionTypes.has(normalized) ? normalized : "note";
}

export function formatPastedMediaMarkdown(media: PastedMedia): string {
  const filename = media.filename.trim() || "asset";
  if (media.mimeType.startsWith("image/")) {
    return `![${escapeMarkdownLabel(filename)}](${media.assetUrl})`;
  }

  if (media.mimeType.startsWith("video/")) {
    return `<video src="${escapeHtml(media.assetUrl)}" controls title="${escapeHtml(filename)}"></video>`;
  }

  return `[${escapeMarkdownLabel(filename)}](${media.assetUrl})`;
}

function remarkReflectaMarkdown() {
  return (tree: any) => {
    if (Array.isArray(tree.children)) {
      tree.children = tree.children.map((node: any) => {
        if (node.type !== "paragraph") return node;

        const lines = collectText(node)
          .split(/\r?\n/)
          .map((line) => line.trimEnd())
          .filter(Boolean);
        if (lines.length < 2 || !lines.slice(1).every((line) => /^:\s+/.test(line))) return node;

        return createDefinitionListNode(lines) ?? node;
      });
    }

    visit(tree, (node: any, index: number | undefined, parent: any) => {
      if (node.type === "containerDirective") {
        const type = normalizeAdmonitionType(node.name);
        node.data = {
          ...node.data,
          hName: "aside",
          hProperties: {
            "data-admonition": "",
            "data-type": type,
            className: ["reflecta-admonition"],
          },
        };
        return;
      }

      if (node.type === "code" && node.lang === "mermaid") {
        node.data = {
          ...node.data,
          hName: "div",
          hProperties: {
            className: ["reflecta-mermaid"],
            "data-mermaid": node.value,
          },
          hChildren: [{ type: "text", value: node.value }],
        };
        return;
      }

      if (node.type !== "text" || !parent || typeof index !== "number") return;

      const value = String(node.value ?? "");
      const replacements: any[] = [];
      let cursor = 0;

      for (const match of value.matchAll(wikiLinkPattern)) {
        const start = match.index ?? -1;
        if (start < 0) continue;
        if (start > cursor) {
          replacements.push({ type: "text", value: value.slice(cursor, start) });
        }

        const title = match[1]?.trim() ?? "";
        const id = match[2]?.trim() ?? "";
        replacements.push({
          type: "html",
          value: `<a href="#" data-wiki-link="${escapeHtml(id)}" class="wiki-link">${escapeHtml(title)}</a>`,
        });
        cursor = start + match[0].length;
      }

      if (replacements.length === 0) return;
      if (cursor < value.length) {
        replacements.push({ type: "text", value: value.slice(cursor) });
      }

      parent.children.splice(index, 1, ...replacements);
    });
  };
}

export function renderMarkdownToHtml(markdown: string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkDirective)
      .use(remarkReflectaMarkdown)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeKatex, { output: "html" })
      .use(rehypeStringify)
      .processSync(markdown),
  );
}
