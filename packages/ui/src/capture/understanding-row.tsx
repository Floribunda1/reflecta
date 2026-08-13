import { FileText, Link2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/context-menu";
import { cn } from "#lib/utils";
import type { ResolveChatEntity } from "../chat/entity";
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
  /** 实体引用解析（id → label），用于 body 摘要里的 [[u:id]] 显示标题 */
  resolveWikiLink?: ResolveChatEntity;
  onSelect: (id: string) => void;
  onAction: (action: UnderstandingRowAction) => void;
};

export function UnderstandingRow({
  understanding,
  selected = false,
  canChat = false,
  actionsDisabled = false,
  resolveWikiLink,
  onSelect,
  onAction,
}: UnderstandingRowProps) {
  // DESIGN: selected state = muted 选中约定（与 domain-tree 一致）——bg-muted 强调选中行；
  // 标题 foreground + semibold 引导行内容；body 保持 muted 大小颜色。
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
              "group flex min-w-0 w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
              selected && "bg-muted active:bg-muted",
            )}
            onClick={() => onSelect(understanding.id)}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                {understanding.title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {understanding.updatedLabel}
              </span>
            </div>

            <div className="min-h-9 text-sm leading-5 text-muted-foreground">
              {understanding.body ? (
                <SimpleMarkdownPreview
                  value={understanding.body}
                  lineClamp={2}
                  resolveWikiLink={resolveWikiLink}
                />
              ) : (
                <span>空理解，可以直接开始写。</span>
              )}
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center gap-3 text-xs",
                selected ? "text-muted-foreground" : "text-muted-foreground",
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
