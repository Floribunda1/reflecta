import { CSSProperties, useEffect, useMemo, useRef } from "react";
import mediumZoom from "medium-zoom";
import { MarkdownEditor } from "../editor";

const wikiLinkPattern = /\[\[([^\]\n#]+)#([^\]\n#]+)\]\]/g;

export function getMarkdownPreviewText(content: string, lineClamp?: number): string {
  const text = content
    .replace(wikiLinkPattern, "$1")
    .replaceAll(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replaceAll(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replaceAll(/[`*_~>#-]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (lineClamp == null ? text : text.slice(0, lineClamp)).join("\n");
}

export function SimpleMarkdownPreview({
  content,
  lineClamp,
}: {
  content: string;
  lineClamp?: number;
}) {
  const text = useMemo(() => getMarkdownPreviewText(content, lineClamp), [content, lineClamp]);
  const style: CSSProperties = {
    maxHeight: lineClamp != null ? `${lineClamp * 1.5}em` : undefined,
    overflow: lineClamp != null ? "hidden" : undefined,
  };

  return (
    <div style={style} className="markdown-preview markdown-preview-compact">
      {text}
    </div>
  );
}

export function MarkdownPreview({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const zoom = mediumZoom();
    const syncZoomImages = () => {
      zoom.detach();
      zoom.attach(el.querySelectorAll("img"));
    };

    const frameId = window.requestAnimationFrame(syncZoomImages);
    const observer = new MutationObserver(syncZoomImages);
    observer.observe(el, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      zoom.detach();
    };
  }, [content]);

  return (
    <div ref={containerRef} className="markdown-preview">
      <MarkdownEditor content={content} height="auto" readonly />
    </div>
  );
}
