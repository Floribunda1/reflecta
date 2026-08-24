import { memo } from "react";
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
import { SimpleMarkdownPreview } from "../editor/simple-markdown-preview";

export type UnderstandingCardView = {
  id: string;
  title: string;
  body: string;
  updatedLabel: string;
  contextCount: number;
  mentionCount: number;
  /** 所属领域路径（如 ["工作", "前端"]），用于卡片上的领域标签 */
  domainNames: string[];
};

export type UnderstandingCardAction = {
  type: "chat" | "delete";
  understanding: UnderstandingCardView;
};

export type UnderstandingCardProps = {
  understanding: UnderstandingCardView;
  selected?: boolean;
  canChat?: boolean;
  actionsDisabled?: boolean;
  /** 实体引用解析（id → label），用于 body 摘要里的 [[u:id]] 显示标题 */
  resolveWikiLink?: ResolveChatEntity;
  onSelect: (id: string) => void;
  onAction: (action: UnderstandingCardAction) => void;
};

/** 网格预览行数：扫标题用，不在首页铺全文。 */
const PREVIEW_LINES = 5;

/**
 * dashboard 网格中的理解卡片 —— 标题 + 预览 + 领域/时间/上下文元数据。
 * 选中约定与 Domain Tree 一致：bg-muted 高亮当前项。
 */
export const UnderstandingCard = memo(function UnderstandingCard({
  understanding,
  selected = false,
  canChat = false,
  actionsDisabled = false,
  resolveWikiLink,
  onSelect,
  onAction,
}: UnderstandingCardProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            data-testid="capture-understanding-card"
            data-understanding-title={understanding.title}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "group flex h-full min-w-0 flex-col gap-2 rounded-xl border bg-card p-3.5 text-left text-sm text-foreground transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
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

            <div className="min-w-0 flex-1 text-sm leading-5 text-muted-foreground">
              {understanding.body ? (
                <SimpleMarkdownPreview
                  value={understanding.body}
                  lineClamp={PREVIEW_LINES}
                  resolveWikiLink={resolveWikiLink}
                />
              ) : (
                <span>空理解，可以直接开始写。</span>
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {understanding.domainNames.length > 0 ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  {understanding.domainNames.slice(0, 2).map((name) => (
                    <span
                      key={name}
                      className="inline-flex max-w-24 items-center rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground"
                    >
                      <span className="truncate">{name}</span>
                    </span>
                  ))}
                  {understanding.domainNames.length > 2 ? (
                    <span>+{understanding.domainNames.length - 2}</span>
                  ) : null}
                </span>
              ) : null}
              <span
                className="ml-auto inline-flex shrink-0 items-center gap-1"
                aria-label={`${understanding.contextCount} 个上下文`}
              >
                <FileText size={13} aria-hidden />
                {understanding.contextCount}
              </span>
              <span
                className="inline-flex shrink-0 items-center gap-1"
                aria-label={`${understanding.mentionCount} 条引用`}
              >
                <Link2 size={13} aria-hidden />
                {understanding.mentionCount}
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
});
