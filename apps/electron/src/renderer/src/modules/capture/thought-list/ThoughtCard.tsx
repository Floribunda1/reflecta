import { useMemo } from "react";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useCapturePageContext } from "../context";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

function getUnderstandingTitle(thought: ThoughtSummaryDTO): string {
  const title = thought.title?.trim();
  if (title) return title;

  const firstLine = thought.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || "未命名理解";
}

export function ThoughtCard({ thought }: { thought: ThoughtSummaryDTO }) {
  const capture = useCapturePageContext();
  const isSelected = capture.selectedThoughtId === thought.id;

  const updatedLabel = useMemo(
    () =>
      formatDistanceToNow(thought.updatedAt, {
        addSuffix: true,
        locale: zhCN,
      }),
    [thought.updatedAt],
  );

  return (
    <button
      type="button"
      className={[
        "w-full rounded-lg border border-l-2 px-3 py-2.5 text-left shadow-none transition-colors",
        isSelected
          ? "border-border/75 border-l-foreground/35 bg-muted/45"
          : "border-border/45 border-l-transparent bg-background/40 hover:border-border/70 hover:bg-muted/30",
      ].join(" ")}
      onClick={() => capture.setSelectedThoughtId(thought.id)}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-foreground">
          {getUnderstandingTitle(thought)}
        </span>
        <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
          {updatedLabel}
        </span>
      </div>

      <div className="mt-1.5 min-h-5 text-sm leading-6 text-muted-foreground line-clamp-2">
        {thought.body ? (
          <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
        ) : (
          <span className="text-muted-foreground/55">空理解，可以直接开始写。</span>
        )}
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
        <span>{thought.contextCount > 0 ? `${thought.contextCount} 个来源` : "无来源"}</span>
        <span>
          {thought.connectionCount > 0 ? `连接到 ${thought.connectionCount} 个理解` : "暂时独立"}
        </span>
      </div>
    </button>
  );
}
