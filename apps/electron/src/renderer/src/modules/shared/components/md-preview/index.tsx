import { CSSProperties, MouseEvent, useEffect, useMemo, useRef } from "react";
import mediumZoom from "medium-zoom";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { ipcClient } from "@renderer/utils/ipc";
import { searchEventBus } from "@renderer/utils/searchEventBus";
import { renderThoughtWikiLinksAsHtml } from "../wiki-links";
import "./style.css";

const markdownRenderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

function renderMarkdownToHtml(content: string): string {
  return String(markdownRenderer.processSync(content));
}

async function handleWikiLinkClick(e: MouseEvent<HTMLDivElement>): Promise<void> {
  const el = e.target as Element | null;
  const link = el?.closest<HTMLAnchorElement>("a[data-wiki-link]");
  if (!link) return;

  e.preventDefault();
  e.stopPropagation();

  const target = link.dataset.wikiLink;
  if (!target) return;

  const id = target.replace(/^\/wiki\//, "").trim();
  if (!id) return;
  const thought = await ipcClient.thought.getThoughtById(id);
  if (!thought) return;

  searchEventBus.emit("thoughtSelected", {
    thoughtId: thought.id,
    categoryIds: thought.categoryIds,
  });
}

export function SimpleMarkdownPreview({
  content,
  lineClamp,
}: {
  content: string;
  lineClamp?: number;
}) {
  const html = useMemo(() => {
    if (!content) return "";
    const truncatedContent = content.split("\n").filter(Boolean).slice(0, lineClamp).join("\n");
    return renderMarkdownToHtml(renderThoughtWikiLinksAsHtml(truncatedContent));
  }, [content, lineClamp]);

  const style: CSSProperties = {
    maxHeight: lineClamp != null ? `${lineClamp * 1.5}em` : undefined,
    overflow: lineClamp != null ? "hidden" : undefined,
  };

  return (
    <div
      style={style}
      className="markdown-preview markdown-preview-compact"
      onClick={handleWikiLinkClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function MarkdownPreview({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const html = useMemo(
    () => renderMarkdownToHtml(renderThoughtWikiLinksAsHtml(content)),
    [content],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    mediumZoom(el.querySelectorAll("img"));
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="markdown-preview"
      onClick={handleWikiLinkClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
