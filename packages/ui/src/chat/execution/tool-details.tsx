import { useState } from "react";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { MarkdownPreview, SimpleMarkdownPreview } from "../../editor/markdown-preview";
import type { AgentToolDetailContent, AgentToolDetailRowView, AgentToolDetailsView } from "./types";

function fencedCodeBlock(value: string, language: string) {
  let fenceLength = 3;
  for (const match of value.matchAll(/`+/g)) {
    fenceLength = Math.max(fenceLength, match[0].length + 1);
  }
  const fence = "`".repeat(fenceLength);
  return `${fence}${language}\n${value}\n${fence}`;
}

function ToolDetailContent({
  content,
  simpleMarkdown,
  lineClamp,
}: {
  content: AgentToolDetailContent;
  simpleMarkdown?: boolean;
  lineClamp?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (content.format === "text") {
    return <div className="line-clamp-2 text-muted-foreground/85">{content.value}</div>;
  }

  const outputLines = content.value.split(/\r?\n/);
  const expandable =
    (content.format === "code" || content.format === "pre") &&
    lineClamp !== undefined &&
    outputLines.length > lineClamp;
  const value =
    expandable && !expanded ? `${outputLines.slice(0, lineClamp).join("\n")}\n...` : content.value;

  return (
    <div className="grid gap-1">
      {content.format === "markdown" && simpleMarkdown ? (
        <SimpleMarkdownPreview
          value={value}
          lineClamp={lineClamp}
          className="text-muted-foreground/85"
        />
      ) : content.format === "markdown" ? (
        <MarkdownPreview
          value={value}
          zoomImages={false}
          className="[&_.ProseMirror]:text-muted-foreground"
        />
      ) : content.format === "code" ? (
        <MarkdownPreview
          key={expanded ? "expanded" : "collapsed"}
          value={fencedCodeBlock(value, content.language)}
          zoomImages={false}
          className="markdown-preview-tool-detail [&_.ProseMirror]:text-muted-foreground"
        />
      ) : (
        <pre className="whitespace-pre-wrap break-words rounded-sm bg-background/65 px-2 py-1.5 font-mono text-xs leading-5 text-muted-foreground">
          {value}
        </pre>
      )}
      {expandable ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="w-fit text-muted-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "收起输出" : "展开完整输出"}
        </Button>
      ) : null}
    </div>
  );
}

function ToolDetailRow({ row }: { row: AgentToolDetailRowView }) {
  const hasHeader = Boolean(row.label || row.title);
  const isListItem = row.appearance === "list-item";
  const isNestedListItem = row.appearance === "nested-list-item";
  return (
    <li
      className={
        isListItem
          ? "mt-2 grid gap-1 rounded-md border border-border/60 bg-background/40 px-3 py-2.5 first:mt-0"
          : isNestedListItem
            ? "ml-5 grid gap-0.5 border-l border-border/70 py-1 pl-3"
            : "grid gap-0.5 rounded-sm py-1"
      }
    >
      {hasHeader ? (
        <div
          className={
            isListItem
              ? "flex min-w-0 items-baseline gap-2"
              : "flex min-w-0 items-baseline gap-2 px-1"
          }
        >
          {row.label && !isListItem ? (
            <span className="shrink-0 text-xs text-muted-foreground">{row.label}</span>
          ) : null}
          {row.title ? (
            <span
              className={
                isListItem
                  ? "min-w-0 break-words font-semibold text-foreground/90"
                  : "min-w-0 break-words font-medium text-foreground/75"
              }
            >
              {row.title}
            </span>
          ) : null}
        </div>
      ) : null}
      {row.content ? (
        <ToolDetailContent
          content={row.content}
          simpleMarkdown={Boolean(row.appearance)}
          lineClamp={row.previewLines}
        />
      ) : null}
    </li>
  );
}

export function hasToolDetails(details: AgentToolDetailsView | undefined) {
  return Boolean(details?.rows?.length || details?.badges?.length || details?.emptyText);
}

export function ToolDetails({ details }: { details: AgentToolDetailsView }) {
  const hasResultList = details.rows?.some((row) => row.appearance === "list-item");
  return (
    <div className="grid gap-2">
      {details.badges?.length ? (
        <div className="flex flex-wrap gap-1.5 px-1">
          {details.badges.map((badge) => (
            <Badge key={badge} variant="secondary">
              {badge}
            </Badge>
          ))}
        </div>
      ) : null}
      {details.rows?.length ? (
        <ul
          className={
            hasResultList
              ? "grid max-h-96 gap-1 overflow-y-auto overscroll-contain pr-1"
              : "grid gap-1"
          }
        >
          {details.rows.map((row) => (
            <ToolDetailRow key={row.id} row={row} />
          ))}
        </ul>
      ) : null}
      {details.emptyText ? (
        <div className="break-words px-1 py-1 text-muted-foreground">{details.emptyText}</div>
      ) : null}
    </div>
  );
}
