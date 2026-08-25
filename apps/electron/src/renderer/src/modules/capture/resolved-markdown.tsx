import {
  MarkdownEditor as BaseMarkdownEditor,
  MarkdownPreview as BaseMarkdownPreview,
  SimpleMarkdownPreview as BaseSimpleMarkdownPreview,
  type MarkdownEditorProps,
} from "@reflecta/ui/editor";
import type { MarkdownRenderProps } from "@reflecta/ui/chat";
import { useEntityDisplayResolver } from "./use-entity-display-resolver";

/**
 * 实体引用解析内聚层：调用方不再需要传 resolveWikiLink。
 * 每个实例按自身 value 收集引用 → 批量拉取标题 → 生成同步 resolver，
 * 请求逻辑全部收敛在 renderer 这层；packages/ui 通过 renderMarkdown prop 接收解析版组件。
 */

export function MarkdownPreview({
  value,
  zoomImages = true,
  onWikiLinkOpen,
  className,
}: MarkdownRenderProps) {
  const resolveWikiLink = useEntityDisplayResolver(value);
  return (
    <BaseMarkdownPreview
      value={value}
      zoomImages={zoomImages}
      onWikiLinkOpen={onWikiLinkOpen}
      className={className}
      resolveWikiLink={resolveWikiLink}
    />
  );
}

export function SimpleMarkdownPreview({ value, lineClamp, className }: MarkdownRenderProps) {
  const resolveWikiLink = useEntityDisplayResolver(value);
  return (
    <BaseSimpleMarkdownPreview
      value={value}
      lineClamp={lineClamp}
      className={className}
      resolveWikiLink={resolveWikiLink}
    />
  );
}

export function MarkdownEditor(props: Omit<MarkdownEditorProps, "resolveWikiLink">) {
  const resolveWikiLink = useEntityDisplayResolver(props.value);
  return <BaseMarkdownEditor {...props} resolveWikiLink={resolveWikiLink} />;
}
