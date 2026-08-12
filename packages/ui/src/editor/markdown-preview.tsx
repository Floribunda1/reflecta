import type { Element, Root, Text } from "hast";
import mediumZoom from "medium-zoom";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { cn } from "#lib/utils";
import type { ChatEntityReference, ResolveChatEntity } from "../chat/entity";
import { EDITOR_ENTITY_ICON_FONT_SIZE, entityIconSvg } from "../chat/entity-visual";
import { MarkdownEditor } from "./markdown-editor";
import "./compact-preview.scss";

const entityReferencePattern = /\[\[([ucd]):([A-Za-z0-9_-]+)\]\]/g;

function rehypeCompactPreview() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName === "a") {
        node.tagName = "span";
        node.properties = {};
        return;
      }
      if ((node.tagName === "img" || node.tagName === "input") && parent && index != null) {
        const value =
          node.tagName === "img"
            ? String(node.properties.alt ?? "")
            : node.properties.checked
              ? "☑ "
              : "☐ ";
        parent.children[index] = { type: "text", value } satisfies Text;
      }
    });
  };
}

const compactMarkdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeCompactPreview)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export type SimpleMarkdownPreviewProps = {
  value: string;
  lineClamp?: number;
  className?: string;
  /** 实体引用解析（id → label）；不传时引用退化为显示 id */
  resolveWikiLink?: ResolveChatEntity;
};

/** HTML 字符串拼接用的最小转义（entity label 可能含特殊字符） */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 解析前按行截断：lineClamp 场景只解析可见部分，减少 unified 解析量与
 *  resolve 调用。未闭合的围栏代码块补闭合，避免截断后整段被解析成 code。 */
function truncateMarkdownForPreview(value: string, lineClamp: number): string {
  const lines = value.split("\n");
  if (lines.length <= lineClamp) return value;
  const kept = lines.slice(0, lineClamp);
  const openFences = kept.filter((line) => /^\s*```/.test(line)).length;
  if (openFences % 2 === 1) kept.push("```");
  return kept.join("\n");
}

export function SimpleMarkdownPreview({
  value,
  lineClamp,
  className,
  resolveWikiLink,
}: SimpleMarkdownPreviewProps) {
  const html = useMemo(() => {
    const source = lineClamp ? truncateMarkdownForPreview(value, lineClamp) : value;
    const processed = compactMarkdownProcessor.processSync(source).toString();
    // [[u:id]] survives parsing as plain text; inject the entity icon SVG into
    // the final HTML (svg cannot pass the sanitize allowlist)。
    return processed.replaceAll(
      entityReferencePattern,
      (_match, prefix: "u" | "c" | "d", id: string) => {
        const type = prefix === "u" ? "understanding" : prefix === "c" ? "context" : "domain";
        const label = resolveWikiLink?.({ type, id } as ChatEntityReference)?.label;
        // 与完整版 wiki-link 一致：title 用主色标记「可点击的实体引用」（icon 同色）。
        const text = label ? escapeHtml(label) : id;
        return `${entityIconSvg(type, EDITOR_ENTITY_ICON_FONT_SIZE)} <span class="text-primary">${text}</span>`;
      },
    );
  }, [value, lineClamp, resolveWikiLink]);
  const style: CSSProperties = {
    maxHeight: lineClamp != null ? `${lineClamp * 1.25}rem` : undefined,
    overflow: lineClamp != null ? "hidden" : undefined,
  };

  return (
    <div
      style={style}
      className={cn(
        "markdown-preview-compact min-w-0 break-words text-body-small leading-5 text-muted-foreground",
        lineClamp != null && "[&>*]:!my-0",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

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
