import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import mediumZoom from "medium-zoom";
import { cn } from "#lib/utils";
import { MarkdownEditor } from "./markdown-editor";

const wikiLinkPattern = /\[\[([^\]\n#]+)#([^\]\n#]+)\]\]/g;

export function getMarkdownPreviewText(value: string, lineClamp?: number): string {
  const lines = value
    .replace(wikiLinkPattern, "$1")
    .replaceAll(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replaceAll(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replaceAll(/[`*_~>#-]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (lineClamp == null ? lines : lines.slice(0, lineClamp)).join("\n");
}

export type SimpleMarkdownPreviewProps = {
  value: string;
  lineClamp?: number;
  className?: string;
};

export function SimpleMarkdownPreview({ value, lineClamp, className }: SimpleMarkdownPreviewProps) {
  const text = useMemo(() => getMarkdownPreviewText(value, lineClamp), [value, lineClamp]);
  const style: CSSProperties = {
    maxHeight: lineClamp != null ? `${lineClamp * 1.5}em` : undefined,
    overflow: lineClamp != null ? "hidden" : undefined,
  };

  return (
    <div style={style} className={cn("markdown-preview markdown-preview-compact", className)}>
      {text}
    </div>
  );
}

export type MarkdownPreviewProps = {
  value: string;
  className?: string;
  zoomImages?: boolean;
  onWikiLinkOpen?: (id: string) => void;
};

export function MarkdownPreview({
  value,
  className,
  zoomImages = true,
  onWikiLinkOpen,
}: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !zoomImages) return;

    const zoom = mediumZoom();
    const syncZoomImages = () => {
      zoom.detach();
      zoom.attach(element.querySelectorAll("img"));
    };
    const frameId = window.requestAnimationFrame(syncZoomImages);
    const observer = new MutationObserver(syncZoomImages);
    observer.observe(element, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      zoom.detach();
    };
  }, [value, zoomImages]);

  return (
    <div ref={containerRef} className={cn("markdown-preview", className)}>
      <MarkdownEditor value={value} height="auto" readOnly onWikiLinkOpen={onWikiLinkOpen} />
    </div>
  );
}
