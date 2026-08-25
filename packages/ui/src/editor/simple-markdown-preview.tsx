import type { Element, Root, Text } from "hast";
import { type CSSProperties, useMemo } from "react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { fromHtml as hastFromHtml } from "hast-util-from-html";
import { cn } from "#lib/utils";
import type { ChatEntityReference, ResolveChatEntity } from "../chat/entity";
import { EDITOR_ENTITY_ICON_FONT_SIZE, entityIconSvg } from "../chat/entity-visual";
import { scanEntityReferences } from "@reflecta/shared";
import "./compact-preview.scss";

/**
 * 紧凑预览的 sanitize schema：默认 schema 之外放行我们自己生成的静态图标
 * （entityIconSvg，lucide 白名单元素与属性）与实体 label 包裹 span。
 * 内容本身仍走默认清洗，这里只开 icon 必需的最小面。
 */
const compactSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "svg",
    "path",
    "circle",
    "line",
    "polyline",
    "rect",
    "polygon",
  ],
  attributes: {
    ...defaultSchema.attributes,
    span: ["className"],
    svg: [
      "viewBox",
      "width",
      "height",
      "fill",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "className",
      "style",
    ],
    path: ["d"],
    circle: ["cx", "cy", "r"],
    line: ["x1", "y1", "x2", "y2"],
    polyline: ["points"],
    rect: ["x", "y", "width", "height", "rx", "ry"],
    polygon: ["points"],
  },
};

type CompactPreviewOptions = {
  resolveWikiLink?: ResolveChatEntity;
};

function rehypeCompactPreview(options: CompactPreviewOptions) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      // 链接 label / 代码：不处理其文本（与编辑器一致，label 内的 [[u:id]]
      // 保持字面；代码块/行内代码是 code/pre 元素，实体引用原样显示）。
      if (node.tagName === "a") {
        node.tagName = "span";
        node.properties = {};
        return;
      }
      if (node.tagName === "code" || node.tagName === "pre") return;
      if ((node.tagName === "img" || node.tagName === "input") && parent && index != null) {
        const value =
          node.tagName === "img"
            ? String(node.properties.alt ?? "")
            : node.properties.checked
              ? "☑ "
              : "☐ ";
        parent.children[index] = { type: "text", value } satisfies Text;
        return;
      }

      // 当前元素的直接文本子节点（深层文本由各自元素访问时处理）。
      // 渲染管线策略与编辑器一致：转义引用按链接渲染（protectEscapes:false）。
      const children = node.children ?? [];
      let changed = false;
      const next: Element["children"] = [];
      for (const child of children) {
        if (child.type !== "text") {
          next.push(child);
          continue;
        }
        const value = child.value ?? "";
        const hits = scanEntityReferences(value, { protectEscapes: false });
        if (hits.length === 0) {
          next.push(child);
          continue;
        }
        changed = true;
        let cursor = 0;
        for (const hit of hits) {
          if (hit.start > cursor)
            next.push({ type: "text", value: value.slice(cursor, hit.start) });
          const reference = { type: hit.reference.type, id: hit.reference.id };
          const label =
            options.resolveWikiLink?.(reference as ChatEntityReference)?.label ?? hit.reference.id;
          const svg = hastFromHtml(entityIconSvg(hit.reference.type, EDITOR_ENTITY_ICON_FONT_SIZE))
            .children as Element["children"];
          next.push({
            type: "element",
            tagName: "span",
            properties: { className: ["text-primary"] },
            children: [...svg, { type: "text", value: label }],
          });
          cursor = hit.end;
        }
        if (cursor < value.length) next.push({ type: "text", value: value.slice(cursor) });
      }
      if (changed) node.children = next;
    });
  };
}

const compactMarkdownProcessor = () =>
  unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, compactSanitizeSchema);

export type SimpleMarkdownPreviewProps = {
  value: string;
  lineClamp?: number;
  className?: string;
  /** 实体引用解析（id → label）；不传时引用退化为显示 id */
  resolveWikiLink?: ResolveChatEntity;
};

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
    // processor 每次新建：rehypeCompactPreview 需要携带当次 resolveWikiLink。
    const processor = compactMarkdownProcessor()
      .use(rehypeCompactPreview, { resolveWikiLink })
      .use(rehypeStringify);
    return processor.processSync(source).toString();
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
