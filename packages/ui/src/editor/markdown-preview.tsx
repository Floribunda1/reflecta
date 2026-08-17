import mediumZoom from "medium-zoom";
import { useEffect, useRef } from "react";
import { cn } from "#lib/utils";
import type { ChatEntityReference, ResolveChatEntity } from "../chat/entity";
import { MarkdownEditor } from "./markdown-editor";

export type MarkdownPreviewProps = {
  value: string;
  className?: string;
  zoomImages?: boolean;
  resolveWikiLink?: ResolveChatEntity;
  onWikiLinkOpen?: (reference: ChatEntityReference) => void;
};

export function MarkdownPreview({
  value,
  className,
  zoomImages = true,
  resolveWikiLink,
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
      <MarkdownEditor
        value={value}
        height="auto"
        readOnly
        resolveWikiLink={resolveWikiLink}
        onWikiLinkOpen={onWikiLinkOpen}
      />
    </div>
  );
}
