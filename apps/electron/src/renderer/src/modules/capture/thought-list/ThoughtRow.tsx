import type { ThoughtSummaryDTO } from "@shared/thought";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useSetAtom } from "jotai";
import { selectedThoughtIdAtom } from "../state";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@renderer/lib/utils";
import { FileText, Link2 } from "lucide-react";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { useThoughtListActions } from "./hooks";

function getUnderstandingTitle(thought: ThoughtSummaryDTO): string {
  const title = thought.title?.trim();
  if (title) return title;

  const firstLine = thought.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || "未命名理解";
}

export function ThoughtRow({
  thought,
  selected = false,
}: {
  thought: ThoughtSummaryDTO;
  selected?: boolean;
}) {
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const { deleteThought } = useThoughtListActions();
  const { confirm } = useModal();

  const updatedLabel = formatDistanceToNow(thought.updatedAt, {
    addSuffix: true,
    locale: zhCN,
  });
  const title = getUnderstandingTitle(thought);

  const handleDelete = () => {
    confirm({
      title: "删除理解",
      message: `确定要删除「${title}」吗？此操作不可撤销。`,
      acceptLabel: "删除",
      danger: true,
      onAccept: () => deleteThought(thought.id),
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            aria-current={selected ? "true" : undefined}
            className={cn(
              "group relative flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm text-card-foreground transition-colors outline-none hover:bg-muted/45 active:bg-muted/55 focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "bg-muted/70 hover:bg-muted/75 active:bg-muted/80",
            )}
            onClick={() => setSelectedThoughtId(thought.id)}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-transparent transition-colors",
                selected && "bg-primary",
              )}
            />

            <div className="flex min-w-0 items-start justify-between gap-3">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  selected ? "text-foreground" : "text-foreground/70",
                )}
              >
                {title}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs",
                  selected ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {updatedLabel}
              </span>
            </div>

            <div
              className={cn(
                "min-h-9 text-sm leading-5",
                selected ? "text-muted-foreground" : "text-muted-foreground/70",
              )}
            >
              {thought.body ? (
                <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
              ) : (
                <span>空理解，可以直接开始写。</span>
              )}
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center gap-3 text-xs",
                selected ? "text-muted-foreground" : "text-muted-foreground/65",
              )}
            >
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
        }
      />
      <ContextMenuContent>
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
