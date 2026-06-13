import type { ThoughtSummaryDTO } from "@shared/thought";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useSetAtom } from "jotai";
import { selectedThoughtIdAtom } from "../state";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@renderer/lib/utils";
import { FileText, Link2 } from "lucide-react";

function getUnderstandingTitle(thought: ThoughtSummaryDTO): string {
  const title = thought.title?.trim();
  if (title) return title;

  const firstLine = thought.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || "未命名理解";
}

export function ThoughtCard({
  thought,
  selected = false,
}: {
  thought: ThoughtSummaryDTO;
  selected?: boolean;
}) {
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);

  const updatedLabel = formatDistanceToNow(thought.updatedAt, {
    addSuffix: true,
    locale: zhCN,
  });

  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left text-sm text-card-foreground shadow-none transition-colors outline-none hover:border-border hover:bg-accent/30 active:border-border active:bg-accent/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        selected &&
          "border-ring bg-card shadow-sm hover:border-ring hover:bg-card active:border-ring active:bg-card",
      )}
      onClick={() => setSelectedThoughtId(thought.id)}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 flex-1 truncate font-medium">
          {getUnderstandingTitle(thought)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{updatedLabel}</span>
      </div>

      <div className="min-h-10 text-sm text-muted-foreground">
        {thought.body ? (
          <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
        ) : (
          <span className="text-muted-foreground">空理解，可以直接开始写。</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${thought.contextCount} 个来源`}
        >
          <FileText size={13} aria-hidden />
          {thought.contextCount}
        </span>
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${thought.connectionCount} 个双链关系`}
        >
          <Link2 size={13} aria-hidden />
          {thought.connectionCount}
        </span>
      </div>
    </button>
  );
}
