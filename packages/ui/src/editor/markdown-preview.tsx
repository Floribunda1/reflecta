import { type CSSProperties, useEffect, useRef } from "react";
import mediumZoom from "medium-zoom";
import { defaultUrlTransform, Streamdown, type Components, type UrlTransform } from "streamdown";
import { cn } from "#lib/utils";
import { MarkdownEditor } from "./markdown-editor";
import { parseUnderstandingWikiLink } from "./wiki-links";

const understandingWikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;

function compactMarkdown(value: string): string {
  return value.replaceAll(understandingWikiLinkPattern, (match) => {
    return parseUnderstandingWikiLink(match)?.title ?? match;
  });
}

const compactMarkdownComponents = {
  a: ({ children }) => <span className="font-medium text-foreground/80">{children}</span>,
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
  input: ({ checked, type }) =>
    type === "checkbox" ? <span aria-hidden="true">{checked ? "☑ " : "☐ "}</span> : null,
} satisfies Components;

const compactUrlTransform: UrlTransform = (url, key, node) =>
  key === "src" ? "about:blank" : defaultUrlTransform(url, key, node);

export type SimpleMarkdownPreviewProps = {
  value: string;
  lineClamp?: number;
  className?: string;
};

export function SimpleMarkdownPreview({ value, lineClamp, className }: SimpleMarkdownPreviewProps) {
  const style: CSSProperties = {
    maxHeight: lineClamp != null ? `${lineClamp * 1.5}em` : undefined,
    overflow: lineClamp != null ? "hidden" : undefined,
  };

  return (
    <div style={style} className={cn("min-w-0", className)}>
      <Streamdown
        mode="static"
        controls={false}
        parseIncompleteMarkdown={false}
        skipHtml
        lineNumbers={false}
        components={compactMarkdownComponents}
        urlTransform={compactUrlTransform}
        className={cn(
          "markdown-preview-compact min-w-0 !space-y-0 break-words text-sm leading-6 text-muted-foreground",
          "[&_h1]:my-1 [&_h1]:text-sm [&_h1]:font-medium [&_h1]:text-foreground/75",
          "[&_h2]:my-1 [&_h2]:text-sm [&_h2]:font-medium [&_h2]:text-foreground/75",
          "[&_h3]:my-1 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground/75",
          "[&_h4]:my-1 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:text-foreground/75",
          "[&_h5]:my-1 [&_h5]:text-sm [&_h5]:font-medium [&_h5]:text-foreground/75",
          "[&_h6]:my-1 [&_h6]:text-sm [&_h6]:font-medium [&_h6]:text-foreground/75",
          "[&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:pl-5 [&_li]:my-0",
          "[&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2",
          "[&_pre]:my-1 [&_pre]:overflow-hidden [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2",
          "[&_code]:break-words [&_code]:font-mono [&_code]:text-[0.9em]",
          "[&_table]:my-1 [&_table]:w-full [&_table]:text-xs",
          "[&_th]:border-b [&_th]:border-border [&_th]:pr-2 [&_th]:text-left [&_th]:font-medium",
          "[&_td]:border-b [&_td]:border-border/60 [&_td]:pr-2",
        )}
      >
        {compactMarkdown(value)}
      </Streamdown>
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
