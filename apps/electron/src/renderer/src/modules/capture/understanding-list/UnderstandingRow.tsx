import type { UnderstandingSummaryDTO } from "@shared/understanding";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@reflecta/ui/components/context-menu";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@reflecta/ui/lib/utils";
import { FileText, Link2 } from "lucide-react";
import { useModal } from "@reflecta/ui/overlays";
import { useUnderstandingListActions } from "./hooks";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import { getUnderstandingTitle } from "../understanding-title";

export function UnderstandingRow({
  understanding,
  selected = false,
  onChat,
}: {
  understanding: UnderstandingSummaryDTO;
  selected?: boolean;
  onChat?: (scope: CaptureAgentScope) => void;
}) {
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const { deleteUnderstanding } = useUnderstandingListActions();
  const { confirm } = useModal();

  const updatedLabel = formatDistanceToNow(understanding.updatedAt, {
    addSuffix: true,
    locale: zhCN,
  });
  const title = getUnderstandingTitle(understanding);

  const handleDelete = () => {
    confirm({
      title: "删除理解",
      message: `确定要删除「${title}」吗？此操作不可撤销。`,
      acceptLabel: "删除",
      danger: true,
      onAccept: () => deleteUnderstanding(understanding.id),
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            data-testid="capture-understanding-row"
            data-understanding-title={title}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "group relative flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm text-card-foreground transition-colors outline-none hover:bg-muted/45 active:bg-muted/55 focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "bg-muted/70 hover:bg-muted/75 active:bg-muted/80",
            )}
            onClick={() => selectUnderstanding(understanding.id)}
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
              {understanding.body ? (
                <SimpleMarkdownPreview content={understanding.body} lineClamp={2} />
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
                aria-label={`${understanding.contextCount} 个上下文`}
              >
                <FileText size={13} aria-hidden />
                {understanding.contextCount}
              </span>
              <span
                className="inline-flex items-center gap-1"
                aria-label={`${understanding.connectionCount} 个双链关系`}
              >
                <Link2 size={13} aria-hidden />
                {understanding.connectionCount}
              </span>
            </div>
          </button>
        }
      />
      <ContextMenuContent>
        {onChat ? (
          <>
            <ContextMenuItem
              onClick={() => {
                selectUnderstanding(understanding.id);
                onChat({ type: "understanding", id: understanding.id, title });
              }}
            >
              和 AI 聊聊
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
