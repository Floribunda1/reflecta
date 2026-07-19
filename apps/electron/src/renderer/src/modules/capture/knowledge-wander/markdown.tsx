import { useMemo } from "react";
import { parseUnderstandingWikiLink } from "@renderer/modules/shared/components/markdown-editor/wiki-links";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import "./markdown.scss";

const wikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;
const wikiLinkHrefPrefix = "#reflecta-wander-wiki/";

function rehypeNonInteractiveLinks() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, "element", (node) => {
      const element = node as unknown as {
        tagName: string;
        properties: Record<string, unknown>;
      };
      if (element.tagName !== "a") return;
      const href = typeof element.properties.href === "string" ? element.properties.href : "";
      element.tagName = "span";
      if (href.startsWith(wikiLinkHrefPrefix)) {
        element.properties = {
          className: ["knowledge-wander-markdown__wiki-link"],
          "data-wiki-link": decodeURIComponent(href.slice(wikiLinkHrefPrefix.length)),
        };
        return;
      }
      element.properties = { className: ["knowledge-wander-markdown__link"] };
    });
  };
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeNonInteractiveLinks)
  .use(rehypeStringify);

export function prepareKnowledgeWanderMarkdown(content: string): string {
  return content
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part) => {
      if (part.startsWith("`")) return part;
      return part.replace(wikiLinkPattern, (match) => {
        const link = parseUnderstandingWikiLink(match);
        if (!link) return match;
        const label = link.title.replaceAll("\\", "\\\\").replaceAll("[", "\\[");
        return `[${label}](${wikiLinkHrefPrefix}${encodeURIComponent(link.id)})`;
      });
    })
    .join("");
}

export function renderKnowledgeWanderMarkdown(content: string): string {
  return String(markdownProcessor.processSync(prepareKnowledgeWanderMarkdown(content)));
}

export function KnowledgeWanderMarkdown({ content }: { content: string }) {
  const html = useMemo(() => renderKnowledgeWanderMarkdown(content), [content]);

  return (
    <div
      data-testid="knowledge-wander-markdown"
      className="knowledge-wander-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
