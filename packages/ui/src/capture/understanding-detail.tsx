import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BookOpen,
  ChevronRight,
  FileText,
  Link2,
  LayoutGrid,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  User,
  Video,
  X,
} from "lucide-react";
import { useState, type ReactNode, type Ref } from "react";
import type { ResolveChatEntity } from "../chat/entity";
import { SimpleMarkdownPreview } from "../editor/simple-markdown-preview";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import { Input } from "../components/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { cn } from "../lib/utils";

export const CONTEXT_META = {
  experience: { label: "个人经历", Icon: User },
  video: { label: "视频", Icon: Video },
  book: { label: "书籍", Icon: BookOpen },
  article: { label: "文章", Icon: FileText },
  opinion: { label: "他人观点", Icon: MessageCircle },
  ai: { label: "AI 生成", Icon: Bot },
  other: { label: "其他", Icon: FileText },
} as const;

export type ContextMediumView = keyof typeof CONTEXT_META;

export const CONTEXT_PLACEHOLDER: Record<ContextMediumView, string> = {
  experience: "",
  video: "视频标题 / 频道名",
  book: "书名 + 章节",
  article: "文章标题 / 平台",
  opinion: "姓名 / 场景",
  ai: "简要描述上下文，选填",
  other: "简要描述上下文，选填",
};

export const CONTEXT_TYPES = Object.keys(CONTEXT_META) as ContextMediumView[];

const FALLBACK_CONTEXT_META: { label: string; Icon: LucideIcon } = {
  label: "上下文",
  Icon: FileText,
};

function contextMeta(medium: string) {
  return CONTEXT_META[medium as ContextMediumView] ?? FALLBACK_CONTEXT_META;
}

export type UnderstandingDetailContextView = {
  id: string;
  medium: string;
  title?: string | null;
  content: string;
};

export type UnderstandingDetailCanvasView = {
  id: string;
  title: string;
};

export function UnderstandingDetailHeader({
  title,
  updatedLabel,
  canvases = [],
  onCanvasOpen,
  focusMode = false,
  className,
  onFocusModeChange,
  onChat,
  onClose,
  onDelete,
  onTitleChange,
  onTitleBlur,
}: {
  title: string;
  updatedLabel: string;
  canvases?: readonly UnderstandingDetailCanvasView[];
  onCanvasOpen?: (canvasId: string) => void;
  focusMode?: boolean;
  className?: string;
  onFocusModeChange?: (focused: boolean) => void;
  onChat?: () => void;
  onClose?: () => void;
  onDelete: () => void;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
}) {
  return (
    <header className="space-y-4">
      <div
        className={cn(
          "flex min-h-8 min-w-0 items-center gap-2 text-xs text-muted-foreground",
          className,
        )}
      >
        {focusMode ? null : (
          <>
            <span>{updatedLabel}</span>
            <span aria-hidden>·</span>
            {onCanvasOpen && canvases.length > 0 ? (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
                      aria-label={`查看关联画布，共 ${canvases.length} 个`}
                    />
                  }
                >
                  <Link2 className="size-3.5" />
                  {canvases.length}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72">
                  <div className="px-1 py-0.5 text-xs font-medium text-muted-foreground">
                    关联画布
                  </div>
                  <div className="flex max-h-60 flex-col overflow-y-auto">
                    {canvases.map((canvas) => (
                      <button
                        key={canvas.id}
                        type="button"
                        className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onCanvasOpen(canvas.id)}
                      >
                        <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{canvas.title}</span>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {onFocusModeChange ? (
            <Button
              data-testid="capture-understanding-focus-button"
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={focusMode ? "退出专注模式" : "进入专注模式"}
              title={focusMode ? "退出专注模式（Esc）" : "进入专注模式"}
              onClick={() => onFocusModeChange(!focusMode)}
            >
              {focusMode ? <Minimize2 /> : <Maximize2 />}
            </Button>
          ) : null}
          {onChat && !focusMode ? (
            <Button
              data-testid="capture-understanding-chat-button"
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="聊聊"
              title="聊聊"
              onClick={onChat}
            >
              <MessageCircle />
            </Button>
          ) : null}
          {!focusMode ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="更多操作"
                    title="更多操作"
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6}>
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {onClose && !focusMode ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="关闭详情"
              title="关闭详情"
              onClick={onClose}
            >
              <X />
            </Button>
          ) : null}
        </div>
      </div>
      <Input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        onBlur={onTitleBlur}
        className="h-auto border-0 bg-transparent px-0 py-0 text-2xl font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent md:text-2xl"
        placeholder="写下一个刚形成的理解"
      />
    </header>
  );
}

export function UnderstandingContextCard({
  context,
  onPreview,
  onEdit,
  onDelete,
  resolveWikiLink,
}: {
  context: UnderstandingDetailContextView;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  resolveWikiLink?: ResolveChatEntity;
}) {
  const meta = contextMeta(context.medium);
  const Icon = meta.Icon;
  const title = context.title?.trim() || meta.label;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div className="relative overflow-hidden rounded-lg border bg-card text-card-foreground">
            <button
              type="button"
              className="flex w-full min-w-0 flex-col gap-2 px-3 py-3 pr-11 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              onClick={onPreview}
              title={`查看${title}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline">
                  <Icon />
                  {meta.label}
                </Badge>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
              </div>
              <div className="text-muted-foreground">
                {context.content ? (
                  <SimpleMarkdownPreview
                    value={context.content}
                    lineClamp={2}
                    resolveWikiLink={resolveWikiLink}
                  />
                ) : (
                  <span>空上下文，可以直接补充内容。</span>
                )}
              </div>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    aria-label={`${title}的更多操作`}
                    title="更多操作"
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Pencil />
          编辑
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function UnderstandingCanvasMembership({
  canvases,
  onOpen,
}: {
  canvases: readonly UnderstandingDetailCanvasView[];
  onOpen: (canvasId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (canvases.length === 0) return null;

  const visibleCanvases = expanded ? canvases : canvases.slice(0, 2);

  return (
    <section className="border-t border-border py-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <span>关联</span>
        <span className="text-muted-foreground">{canvases.length} 个画布</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleCanvases.map((canvas) => (
          <button
            key={canvas.id}
            type="button"
            data-testid="capture-understanding-canvas"
            data-canvas-id={canvas.id}
            data-canvas-title={canvas.title}
            className="flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onOpen(canvas.id)}
            title="在画布中打开"
          >
            <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{canvas.title}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        ))}
        {canvases.length > 2 ? (
          <button
            type="button"
            className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "收起" : `查看全部 ${canvases.length}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function UnderstandingDetailLayout<T extends UnderstandingDetailContextView>({
  articleRef,
  header,
  body,
  metadata,
  contexts,
  canvasMembership,
  focusMode = false,
  onAddContext,
  onPreviewContext,
  onEditContext,
  onDeleteContext,
  resolveWikiLink,
}: {
  articleRef?: Ref<HTMLElement>;
  header: ReactNode;
  body: ReactNode;
  metadata?: ReactNode;
  contexts: readonly T[];
  canvasMembership?: ReactNode;
  focusMode?: boolean;
  onAddContext: () => void;
  onPreviewContext: (context: T) => void;
  onEditContext: (context: T) => void;
  onDeleteContext: (context: T) => void;
  resolveWikiLink?: ResolveChatEntity;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-4xl shrink-0 px-4 py-3 sm:px-6">{header}</div>
      <article
        ref={articleRef}
        className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto px-4 pb-3 sm:px-6"
      >
        <section className="mt-5">{body}</section>
        {metadata ? <div className="mt-5">{metadata}</div> : null}
        {focusMode ? null : (
          <>
            <section className="mt-8 border-t border-border pt-5 pb-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  上下文 <span className="text-muted-foreground">{contexts.length}</span>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={onAddContext}>
                  <Plus />
                  添加上下文
                </Button>
              </div>
              {contexts.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {contexts.map((context) => (
                    <UnderstandingContextCard
                      key={context.id}
                      context={context}
                      onPreview={() => onPreviewContext(context)}
                      onEdit={() => onEditContext(context)}
                      onDelete={() => onDeleteContext(context)}
                      resolveWikiLink={resolveWikiLink}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-6 text-sm text-muted-foreground">暂时没有上下文。</p>
              )}
            </section>
            {canvasMembership}
          </>
        )}
      </article>
    </div>
  );
}
