import { CSSProperties, MouseEvent, useEffect, useMemo, useRef } from "react";
import mediumZoom from "medium-zoom";
import mermaid from "mermaid";
import { ipcClient } from "@renderer/utils/ipc";
import { searchEventBus } from "@renderer/utils/searchEventBus";
import { renderMarkdownToHtml } from "../md-editor/markdown-support";
import "katex/dist/katex.min.css";
import "./style.css";

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
    return renderMarkdownToHtml(truncatedContent);
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
  const html = useMemo(() => renderMarkdownToHtml(content), [content]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    mediumZoom(el.querySelectorAll("img"));
  }, [html]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    let cancelled = false;

    const render = async () => {
      const blocks = Array.from(el.querySelectorAll<HTMLElement>(".reflecta-mermaid"));
      await Promise.all(
        blocks.map(async (block, index) => {
          const source = block.dataset.mermaid || block.textContent || "";
          if (!source.trim()) return;
          try {
            const result = await mermaid.render(`reflecta-mermaid-${Date.now()}-${index}`, source);
            if (!cancelled) block.innerHTML = result.svg;
          } catch {
            block.dataset.mermaidError = "true";
            block.textContent = source;
          }
        }),
      );
    };

    void render();
    return () => {
      cancelled = true;
    };
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
