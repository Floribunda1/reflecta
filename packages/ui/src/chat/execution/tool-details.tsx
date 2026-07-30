import { Badge } from "../../components/badge";
import { MarkdownPreview } from "../../editor/markdown-preview";
import type { AgentToolDetailContent, AgentToolDetailRowView, AgentToolDetailsView } from "./types";

function fencedCodeBlock(value: string, language: string) {
  let fenceLength = 3;
  for (const match of value.matchAll(/`+/g)) {
    fenceLength = Math.max(fenceLength, match[0].length + 1);
  }
  const fence = "`".repeat(fenceLength);
  return `${fence}${language}\n${value}\n${fence}`;
}

function ToolDetailContent({ content }: { content: AgentToolDetailContent }) {
  if (content.format === "text") {
    return <div className="line-clamp-2 text-muted-foreground/85">{content.value}</div>;
  }
  if (content.format === "markdown") {
    return (
      <MarkdownPreview
        value={content.value}
        zoomImages={false}
        className="[&_.ProseMirror]:text-muted-foreground"
      />
    );
  }
  if (content.format === "code") {
    return (
      <MarkdownPreview
        value={fencedCodeBlock(content.value, content.language)}
        zoomImages={false}
        className="markdown-preview-tool-detail [&_.ProseMirror]:text-muted-foreground"
      />
    );
  }
  return (
    <pre className="whitespace-pre-wrap break-words rounded-sm bg-background/65 px-2 py-1.5 font-mono text-xs leading-5 text-muted-foreground">
      {content.value}
    </pre>
  );
}

function ToolDetailRow({ row }: { row: AgentToolDetailRowView }) {
  const hasHeader = Boolean(row.label || row.title);
  return (
    <li className="grid gap-0.5 rounded-sm py-1">
      {hasHeader ? (
        <div className="flex min-w-0 items-baseline gap-2 px-1">
          {row.label ? (
            <span className="shrink-0 text-xs text-muted-foreground">{row.label}</span>
          ) : null}
          {row.title ? (
            <span className="min-w-0 break-words font-medium text-foreground/75">{row.title}</span>
          ) : null}
        </div>
      ) : null}
      {row.content ? <ToolDetailContent content={row.content} /> : null}
    </li>
  );
}

export function hasToolDetails(details: AgentToolDetailsView | undefined) {
  return Boolean(details?.rows?.length || details?.badges?.length || details?.emptyText);
}

export function ToolDetails({ details }: { details: AgentToolDetailsView }) {
  return (
    <div className="grid gap-2">
      {details.rows?.length ? (
        <ul className="grid gap-1">
          {details.rows.map((row) => (
            <ToolDetailRow key={row.id} row={row} />
          ))}
        </ul>
      ) : null}
      {details.badges?.length ? (
        <div className="flex flex-wrap gap-1.5 px-1">
          {details.badges.map((badge) => (
            <Badge key={badge} variant="secondary">
              {badge}
            </Badge>
          ))}
        </div>
      ) : null}
      {details.emptyText ? (
        <div className="break-words px-1 py-1 text-muted-foreground">{details.emptyText}</div>
      ) : null}
    </div>
  );
}
