import { FileText, Link2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/context-menu";
import { cn } from "../lib/utils";
import { SimpleMarkdownPreview } from "../editor";

export type UnderstandingRowView = {
  id: string;
  title: string;
  body: string;
  updatedLabel: string;
  contextCount: number;
  connectionCount: number;
};

export type UnderstandingRowAction = {
  type: "chat" | "delete";
  understanding: UnderstandingRowView;
};

export type UnderstandingRowProps = {
  understanding: UnderstandingRowView;
  selected?: boolean;
  canChat?: boolean;
  actionsDisabled?: boolean;
  onSelect: (id: string) => void;
  onAction: (action: UnderstandingRowAction) => void;
};

export function UnderstandingRow({
  understanding,
  selected = false,
  canChat = false,
  actionsDisabled = false,
  onSelect,
  onAction,
}: UnderstandingRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            data-testid="capture-understanding-row"
            data-understanding-title={understanding.title}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "group relative flex min-w-0 w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm text-card-foreground transition-colors outline-none hover:bg-muted/45 active:bg-muted/55 focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "bg-muted/70 hover:bg-muted/75 active:bg-muted/80",
            )}
            onClick={() => onSelect(understanding.id)}
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
                {understanding.title}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs",
                  selected ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {understanding.updatedLabel}
              </span>
            </div>

            <div
              className={cn(
                "min-h-9 text-sm leading-5",
                selected ? "text-muted-foreground" : "text-muted-foreground/70",
              )}
            >
              {understanding.body ? (
                <SimpleMarkdownPreview value={understanding.body} lineClamp={2} />
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
        {canChat ? (
          <>
            <ContextMenuItem
              disabled={actionsDisabled}
              onClick={() => onAction({ type: "chat", understanding })}
            >
              和 AI 聊聊
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem
          variant="destructive"
          disabled={actionsDisabled}
          onClick={() => onAction({ type: "delete", understanding })}
        >
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
