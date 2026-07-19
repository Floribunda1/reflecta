import { useMemo } from "react";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import "./markdown.scss";

const wikiLinkPattern = /\[\[([^\]\n#]+)(?:#[^\]\n#]+)?\]\]/g;

function rehypeNonInteractiveLinks() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, "element", (node) => {
      const element = node as unknown as {
        tagName: string;
        properties: Record<string, unknown>;
      };
      if (element.tagName !== "a") return;
      element.tagName = "span";
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
  return content.replace(wikiLinkPattern, "$1");
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
