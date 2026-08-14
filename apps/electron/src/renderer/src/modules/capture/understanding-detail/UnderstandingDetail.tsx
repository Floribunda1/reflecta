import { Badge } from "@reflecta/ui/components/badge";
import { Button } from "@reflecta/ui/components/button";
import { DomainTreeSelect } from "@reflecta/ui/capture";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@reflecta/ui/components/context-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@reflecta/ui/components/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@reflecta/ui/components/field";
import { FOCUS_MODE_OFFSET_CLASS } from "@renderer/modules/shared/layout/layout-constants";
import { Input } from "@reflecta/ui/components/input";
import { Tabs, TabsList, TabsTrigger } from "@reflecta/ui/components/tabs";
import {
  markdownEquals,
  MarkdownEditor,
  MarkdownPreview,
  SimpleMarkdownPreview,
} from "@reflecta/ui/editor";
import {
  collectChatEntityReferences,
  type ChatEntityPresentation,
  type ChatEntityReference,
  type ResolveChatEntity,
} from "@reflecta/ui/chat";
import { useDrawer } from "@reflecta/ui/overlays";
import { useModal } from "@reflecta/ui/overlays";
import type { ContextDTO, ContextMedium } from "@shared/context";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  FileText,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUnderstandingDetail, useUnderstandingDetailActions } from "./hooks";
import { CONTEXT_META, CONTEXT_PLACEHOLDER, CONTEXT_TYPES } from "./context/types";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import { useUnderstandingDraftSave } from "../useUnderstandingDraftSave";
import {
  getMarkdownEditorSuggestions,
  uploadMarkdownAsset,
} from "../adapters/markdown-editor-adapter";
import { captureQueryKeys, getEntityDisplay, useCaptureDomains } from "../queries";

type UnderstandingDetailProps = {
  understandingId: string;
  onClose?: () => void;
  onDeleted?: () => void;
  onWikiLinkClick?: (understandingId: string) => void;
  onChat?: (scope: CaptureAgentScope) => void;
  focusMode?: boolean;
  onFocusModeChange?: (focused: boolean) => void;
};

type ContextDraftInput = {
  medium: ContextMedium;
  title: string;
  content: string;
};

const CONTEXT_DRAWER_WIDTH_CLASS =
  "data-[side=right]:w-[min(760px,calc(100vw-2rem))] data-[side=right]:sm:max-w-none";
const FALLBACK_CONTEXT_META = { label: "上下文", Icon: FileText };

function contextLabel(type: ContextMedium): string {
  return CONTEXT_META[type].label;
}

function contextMeta(type: ContextMedium | string) {
  return CONTEXT_META[type as ContextMedium] ?? FALLBACK_CONTEXT_META;
}

function createEmptyContextDraft(): ContextDraftInput {
  return {
    medium: "experience",
    title: "",
    content: "",
  };
}

function createContextDraft(context: ContextDTO | null): ContextDraftInput {
  if (!context) return createEmptyContextDraft();
  return {
    medium: context.medium,
    title: context.title ?? "",
    content: context.content,
  };
}

function ContextPreview({
  context,
  onPreview,
  onEdit,
  onDelete,
  resolveWikiLink,
}: {
  context: ContextDTO;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  resolveWikiLink: ResolveChatEntity;
}) {
  const meta = contextMeta(context.medium);
  const Icon = meta.Icon;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            className="group flex w-full min-w-0 flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-left text-sm text-card-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onPreview}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="outline">
                <Icon size={11} />
                {meta.label}
              </Badge>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {context.title?.trim() || meta.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {context.content.length} 字
              </span>
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
        }
      />
      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Pencil size={14} />
          编辑
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 size={14} />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function ContextPreviewDrawerContent({
  context,
  focusMode = false,
  onFocusModeChange,
  onClose,
  resolveWikiLink,
}: {
  context: ContextDTO;
  focusMode?: boolean;
  onFocusModeChange?: (focused: boolean) => void;
  onClose?: () => void;
  resolveWikiLink?: ResolveChatEntity;
}) {
  const meta = contextMeta(context.medium);
  const Icon = meta.Icon;
  const inspectorMode = Boolean(onFocusModeChange || onClose);

  if (inspectorMode) {
    return (
      <article className="mx-auto h-full overflow-y-auto px-6 py-3">
        <header className="space-y-4">
          <div
            className={`flex min-h-8 min-w-0 items-center gap-2 text-xs text-muted-foreground ${focusMode ? FOCUS_MODE_OFFSET_CLASS : ""}`}
          >
            {focusMode ? null : (
              <>
                <Badge variant="outline">
                  <Icon size={11} />
                  {meta.label}
                </Badge>
                <span className="shrink-0">{context.content.length} 字</span>
              </>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {onFocusModeChange ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={focusMode ? "退出专注模式" : "进入专注模式"}
                  title={focusMode ? "退出专注模式（Esc）" : "进入专注模式"}
                  onClick={() => onFocusModeChange(!focusMode)}
                >
                  {focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </Button>
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
                  <X size={15} />
                </Button>
              ) : null}
            </div>
          </div>
          <h1 className="text-2xl font-semibold">{context.title?.trim() || meta.label}</h1>
        </header>

        <section className="mt-5">
          {context.content ? (
            <MarkdownPreview value={context.content} resolveWikiLink={resolveWikiLink} />
          ) : (
            <div className="text-sm text-muted-foreground">空上下文。</div>
          )}
        </section>
      </article>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b pb-4">
        <Badge variant="outline">
          <Icon size={11} />
          {meta.label}
        </Badge>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {context.title?.trim() || meta.label}
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">{context.content.length} 字</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {context.content ? (
          <MarkdownPreview value={context.content} resolveWikiLink={resolveWikiLink} />
        ) : (
          <div className="text-sm text-muted-foreground">
            空上下文，可以通过右键菜单编辑补充内容。
          </div>
        )}
      </div>
    </div>
  );
}

function ContextDetailDrawerContent({
  context,
  creating,
  editorKey,
  onSave,
}: {
  context: ContextDTO | null;
  creating: boolean;
  editorKey: string;
  onSave: (input: ContextDraftInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ContextDraftInput>(() => createContextDraft(context));
  const [saving, setSaving] = useState(false);
  const { closeDrawer } = useDrawer();

  if (!creating && !context) return null;

  const mediumPlaceholder = CONTEXT_PLACEHOLDER[draft.medium] || "上下文标题或场景";

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      closeDrawer();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FieldGroup className="min-h-0 flex-1 gap-4">
        <Field className="w-auto">
          <FieldLabel>上下文媒介</FieldLabel>
          <Tabs
            value={draft.medium}
            onValueChange={(value) =>
              setDraft((current) => ({ ...current, medium: value as ContextMedium }))
            }
          >
            <TabsList>
              {CONTEXT_TYPES.map((type) => {
                const meta = CONTEXT_META[type];
                const Icon = meta.Icon;
                return (
                  <TabsTrigger key={type} value={type}>
                    <Icon size={14} />
                    {contextLabel(type)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </Field>

        <Field>
          <FieldLabel>上下文标题</FieldLabel>
          <Input
            value={draft.title}
            onChange={(event) => {
              const title = event.target.value;
              setDraft((current) => ({ ...current, title }));
            }}
            placeholder={mediumPlaceholder}
          />
        </Field>

        <Field className="min-h-0 flex-1">
          <FieldLabel>上下文内容</FieldLabel>
          <FieldDescription>{draft.content.length} 字</FieldDescription>
          <MarkdownEditor
            documentId={editorKey}
            value={draft.content}
            height="100%"
            placeholder="记录这条上下文的具体内容"
            uploadAsset={uploadMarkdownAsset}
            getSuggestions={getMarkdownEditorSuggestions}
            onChange={(content) => {
              setDraft((current) =>
                markdownEquals(content, current.content) ? current : { ...current, content },
              );
            }}
          />
        </Field>
      </FieldGroup>
      <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={closeDrawer}>
          取消
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          保存
        </Button>
      </div>
    </div>
  );
}

function UnderstandingDetailInner({
  understandingId,
  onClose,
  onDeleted,
  onWikiLinkClick,
  onChat,
  focusMode = false,
  onFocusModeChange,
}: UnderstandingDetailProps) {
  const detailRef = useRef<HTMLElement>(null);
  const { understanding } = useUnderstandingDetail(understandingId);
  const { domains, loading: domainsLoading } = useCaptureDomains();
  const { updateUnderstanding, deleteUnderstanding, createContext, updateContext, deleteContext } =
    useUnderstandingDetailActions(understandingId);
  const { confirm } = useModal();
  const { openDrawer, closeDrawer } = useDrawer();
  const draft = useCaptureStore((state) =>
    state.draft?.understandingId === understandingId ? state.draft : null,
  );
  const activeContextId = useCaptureStore((state) => state.activeContextId);
  const initializeDraft = useCaptureStore((state) => state.initializeDraft);
  const updateDraftTitle = useCaptureStore((state) => state.updateDraftTitle);
  const updateDraftBody = useCaptureStore((state) => state.updateDraftBody);
  const setActiveContextId = useCaptureStore((state) => state.setActiveContextId);
  const { saveDraft } = useUnderstandingDraftSave({ understandingId, scopeRef: detailRef });
  const referenceSource = draft?.body ?? understanding?.body ?? "";
  const entityReferences = useMemo(
    () => collectChatEntityReferences(referenceSource),
    [referenceSource],
  );
  const entityQueries = useQueries({
    queries: entityReferences.map((reference) => ({
      queryKey: captureQueryKeys.entityDisplay(reference),
      queryFn: () => getEntityDisplay(reference),
    })),
  });
  const entityPresentations = useMemo(() => {
    const result = new Map<string, ChatEntityPresentation>();
    entityReferences.forEach((reference, index) => {
      const query = entityQueries[index];
      if (query?.data) {
        result.set(`${reference.type}:${reference.id}`, {
          state: "ready",
          label: query.data.title || reference.id,
          canOpen: reference.type !== "domain",
        });
      }
    });
    return result;
  }, [entityQueries, entityReferences]);
  const resolveWikiLink = useCallback(
    (reference: ChatEntityReference) =>
      entityPresentations.get(`${reference.type}:${reference.id}`),
    [entityPresentations],
  );

  useEffect(() => {
    if (!understanding) return;
    initializeDraft({
      understandingId: understanding.id,
      title: understanding.title ?? "",
      body: understanding.body,
    });
  }, [understanding?.id, understanding?.title, understanding?.body, initializeDraft]);

  if (!understanding) {
    return <div className="h-full" />;
  }

  const title = draft?.title ?? understanding.title ?? "";
  const body = draft?.body ?? understanding.body;
  const updatedLabel = formatDistanceToNow(understanding.updatedAt, {
    addSuffix: true,
    locale: zhCN,
  });

  const handleDeleteUnderstanding = () => {
    confirm({
      title: "删除理解",
      message: "确定要删除这条理解吗？此操作不可撤销。",
      acceptLabel: "删除",
      danger: true,
      onAccept: async () => {
        await deleteUnderstanding();
        onDeleted?.();
      },
    });
  };

  const openContextDrawer = (context: ContextDTO | null) => {
    const contextId = context?.id ?? null;
    const creating = contextId === null;
    if (contextId) {
      setActiveContextId(contextId);
    } else {
      setActiveContextId(null);
    }

    openDrawer(
      {
        title: creating ? "添加上下文" : "上下文详情",
        widthClassName: CONTEXT_DRAWER_WIDTH_CLASS,
        onClose: () => setActiveContextId(null),
      },
      <ContextDetailDrawerContent
        context={context}
        creating={creating}
        editorKey={contextId ?? "context-new"}
        onSave={async (input) => {
          if (creating) {
            await createContext({
              medium: input.medium,
              title: input.title,
              content: input.content,
            });
            return;
          }

          await updateContext(contextId, {
            medium: input.medium,
            title: input.title,
            content: input.content,
          });
        }}
      />,
    );
  };

  const handleAddContext = () => {
    openContextDrawer(null);
  };

  const openContextPreview = (context: ContextDTO) => {
    setActiveContextId(context.id);
    openDrawer(
      {
        title: "上下文预览",
        widthClassName: CONTEXT_DRAWER_WIDTH_CLASS,
        onClose: () => setActiveContextId(null),
      },
      <ContextPreviewDrawerContent context={context} resolveWikiLink={resolveWikiLink} />,
    );
  };

  const handleDeleteContext = (context: ContextDTO) => {
    confirm({
      title: "删除上下文",
      message: "确定要删除这条上下文吗？此操作不可撤销。",
      acceptLabel: "删除",
      danger: true,
      onAccept: async () => {
        await deleteContext(context.id);
        if (activeContextId === context.id) {
          setActiveContextId(null);
          closeDrawer();
        }
      },
    });
  };

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <article ref={detailRef} className="mx-auto h-full overflow-y-auto px-6 py-3">
        <header className="space-y-4">
          <div
            className={`flex min-h-8 min-w-0 items-center gap-2 text-xs text-muted-foreground ${focusMode ? FOCUS_MODE_OFFSET_CLASS : ""}`}
          >
            {focusMode ? null : (
              <>
                <span>{updatedLabel}</span>
                <span aria-hidden>·</span>
                <DomainTreeSelect
                  value={understanding.domainIds}
                  onValueChange={(domainIds) => void updateUnderstanding({ domainIds })}
                  nodes={domains}
                  status={domainsLoading ? "loading" : "ready"}
                  placeholder="未归入 Domain"
                  fluid={false}
                  showPath={false}
                  variant="inline"
                />
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
                  {focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
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
                  onClick={() =>
                    onChat({
                      type: "understanding",
                      id: understanding.id,
                      title: title.trim() || understanding.title || undefined,
                    })
                  }
                >
                  <MessageCircle size={15} />
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
                    <MoreHorizontal size={15} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={6}>
                    <DropdownMenuItem variant="destructive" onClick={handleDeleteUnderstanding}>
                      <Trash2 size={15} />
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
                  <X size={15} />
                </Button>
              ) : null}
            </div>
          </div>
          <Input
            value={title}
            onChange={(event) => {
              const next = event.target.value;
              updateDraftTitle(next);
            }}
            onBlur={() => void saveDraft()}
            // DESIGN: EditableText 语义——标题内联编辑，聚焦不显示输入框外壳，视觉与页面标题一致（focus-visible:ring-0 有意关闭）。
            // Input 组件内置 text-base + md:text-sm，tailwind-merge 无法移除
            // 响应式 md:text-sm，需要 md:text-2xl 在 md+ 重新声明标题字号。
            className="h-auto border-0 dark:bg-transparent bg-transparent px-0 py-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl"
            placeholder="写下一个刚形成的理解"
          />
        </header>

        <section className="mt-5">
          <MarkdownEditor
            documentId={understanding.id}
            value={body}
            height="auto"
            maxHeight={focusMode ? "calc(100vh - 140px)" : "clamp(320px, 50vh, 560px)"}
            placeholder="用自己的语言写下这条理解。输入 [[ 连接相关理解。"
            uploadAsset={uploadMarkdownAsset}
            getSuggestions={getMarkdownEditorSuggestions}
            resolveWikiLink={resolveWikiLink}
            onChange={(next) => {
              if (markdownEquals(next, body)) return;
              updateDraftBody(next);
            }}
            onBlur={(markdown) => void saveDraft(markdown)}
            onWikiLinkOpen={(reference) => {
              if (reference.type === "understanding") onWikiLinkClick?.(reference.id);
            }}
          />
        </section>

        <section
          className={`mt-10 flex flex-col gap-3 border-t border-border pt-8 pb-6 ${focusMode ? "hidden" : ""}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm leading-8 font-medium">上下文</div>
            <Button type="button" size="sm" variant="ghost" onClick={handleAddContext}>
              <Plus size={14} />
              添加上下文
            </Button>
          </div>
          {understanding.contexts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {understanding.contexts.map((context) => (
                <ContextPreview
                  key={context.id}
                  context={context}
                  onPreview={() => openContextPreview(context)}
                  onEdit={() => openContextDrawer(context)}
                  onDelete={() => handleDeleteContext(context)}
                  resolveWikiLink={resolveWikiLink}
                />
              ))}
            </div>
          ) : (
            <Empty className="flex-none py-10">
              <EmptyContent>
                <EmptyMedia variant="icon">
                  <Plus />
                </EmptyMedia>
                <EmptyDescription>暂时没有上下文</EmptyDescription>
              </EmptyContent>
            </Empty>
          )}
        </section>
      </article>
    </div>
  );
}

export function UnderstandingDetail(props: UnderstandingDetailProps) {
  return <UnderstandingDetailInner key={props.understandingId} {...props} />;
}
