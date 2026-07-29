import { useState, type CSSProperties } from "react";
import { Diff, Hunk, parseDiff } from "react-diff-view";
import "react-diff-view/style/index.css";
import { Badge } from "../../components/badge";
import type { ChatEntityBindings } from "../entity";
import { ChatMarkdown } from "../markdown/chat-markdown";
import type { AgentToolDetailContent, AgentToolDetailRowView, AgentToolDetailsView } from "./types";

const diffTheme = {
  "--diff-text-color": "var(--muted-foreground)",
  "--diff-font-family": "var(--font-mono)",
  "--diff-gutter-insert-background-color":
    "color-mix(in oklab, var(--color-emerald-500) 14%, transparent)",
  "--diff-gutter-delete-background-color":
    "color-mix(in oklab, var(--destructive) 14%, transparent)",
  "--diff-code-insert-background-color":
    "color-mix(in oklab, var(--color-emerald-500) 8%, transparent)",
  "--diff-code-delete-background-color": "color-mix(in oklab, var(--destructive) 8%, transparent)",
  "--diff-code-insert-edit-background-color":
    "color-mix(in oklab, var(--color-emerald-500) 22%, transparent)",
  "--diff-code-delete-edit-background-color":
    "color-mix(in oklab, var(--destructive) 22%, transparent)",
} as CSSProperties;

function ToolDiff({ value }: { value: string }) {
  try {
    const files = parseDiff(value);
    if (files.length === 0) throw new Error("Empty diff");
    return (
      <div
        className="max-h-80 overflow-auto rounded-sm border border-border/60 bg-background/45 text-xs"
        style={diffTheme}
      >
        {files.map((file, index) => (
          <Diff
            key={`${file.oldRevision}-${file.newRevision}-${index}`}
            viewType="unified"
            diffType={file.type}
            hunks={file.hunks}
            gutterType="none"
          >
            {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
          </Diff>
        ))}
      </div>
    );
  } catch {
    return (
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-background/65 px-2 py-1.5 font-mono text-xs leading-5 text-muted-foreground">
        {value}
      </pre>
    );
  }
}

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
  if (content.format === "diff") return <ToolDiff value={content.value} />;

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
  return Boolean(
    details?.meta?.length || details?.rows?.length || details?.badges?.length || details?.emptyText,
  );
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
