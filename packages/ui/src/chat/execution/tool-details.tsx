import { useState } from "react";
import type { ChatEntityBindings } from "../entity";
import { ChatMarkdown } from "../markdown/chat-markdown";
import type { AgentToolDetailContent, AgentToolDetailRowView, AgentToolDetailsView } from "./types";

function ToolDetailContent({
  content,
  entityBindings,
}: {
  content: AgentToolDetailContent;
  entityBindings?: ChatEntityBindings;
}) {
  const [expanded, setExpanded] = useState(false);
  if (content.format === "text") {
    return <div className="line-clamp-2 text-muted-foreground/85">{content.value}</div>;
  }

  const value = expanded && content.full ? content.full : content.preview;
  const expandable = Boolean(content.full);
  const containerClass = expandable
    ? expanded
      ? "max-h-80 overflow-auto"
      : "max-h-32 overflow-hidden"
    : "";

  return (
    <div className="grid gap-1">
      {content.format === "markdown" ? (
        <div className={containerClass}>
          <ChatMarkdown value={value} tone="muted" {...entityBindings} />
        </div>
      ) : (
        <pre
          className={`whitespace-pre-wrap break-words rounded-sm bg-background/65 px-2 py-1.5 font-mono text-xs leading-5 text-muted-foreground ${containerClass}`}
        >
          {value}
        </pre>
      )}
      {expandable ? (
        <button
          type="button"
          className="w-fit rounded-sm px-1 text-xs text-muted-foreground hover:bg-background/70 hover:text-foreground"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? content.format === "markdown"
              ? "收起内容"
              : "收起输出"
            : content.format === "markdown"
              ? "展开完整内容"
              : "展开完整输出"}
        </button>
      ) : null}
    </div>
  );
}

function ToolDetailRow({
  row,
  entityBindings,
}: {
  row: AgentToolDetailRowView;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <li className="grid gap-0.5 rounded-sm px-1 py-1 hover:bg-background/45">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">{row.label}</span>
        <span className="min-w-0 break-words font-medium text-foreground/75">{row.title}</span>
      </div>
      {row.content ? (
        <ToolDetailContent content={row.content} entityBindings={entityBindings} />
      ) : null}
      {row.meta?.length ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground/80">
          {row.meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function hasToolDetails(details: AgentToolDetailsView | undefined) {
  return Boolean(details?.meta?.length || details?.rows?.length || details?.emptyText);
}

export function ToolDetails({
  details,
  entityBindings,
}: {
  details: AgentToolDetailsView;
  entityBindings?: ChatEntityBindings;
}) {
  return (
    <div className="grid gap-2">
      {details.meta?.length ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
          {details.meta.map((detail) => (
            <span key={`${detail.label}:${detail.value}`} className="min-w-0">
              <span>{detail.label}：</span>
              <span className="break-words">{detail.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {details.rows?.length ? (
        <ul className="grid gap-1">
          {details.rows.map((row) => (
            <ToolDetailRow key={row.id} row={row} entityBindings={entityBindings} />
          ))}
        </ul>
      ) : null}
      {details.emptyText ? (
        <div className="break-words px-1 py-1 text-muted-foreground">{details.emptyText}</div>
      ) : null}
    </div>
  );
}
