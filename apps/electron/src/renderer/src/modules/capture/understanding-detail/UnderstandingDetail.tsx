import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@renderer/components/ui/field";
import { Input } from "@renderer/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@renderer/components/ui/tabs";
import { DomainTreeSelect } from "@renderer/modules/shared/biz-components/DomainTreeSelect";
import { MarkdownEditor } from "@renderer/modules/shared/components/markdown-editor/editor";
import { milkdownMarkdownEquals } from "@renderer/modules/shared/components/markdown-editor/editor/markdown-normalize";
import {
  MarkdownPreview,
  SimpleMarkdownPreview,
} from "@renderer/modules/shared/components/markdown-editor/preview";
import { useSharedDrawer } from "@renderer/modules/shared/hooks/use-drawer";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import type { ContextDTO, ContextMedium } from "@shared/context";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUnderstandingDetail, useUnderstandingDetailActions } from "./hooks";
import { CONTEXT_META, CONTEXT_PLACEHOLDER, CONTEXT_TYPES } from "./context/types";
import { useCaptureStore } from "../store";
import { useUnderstandingDraftSave } from "../useUnderstandingDraftSave";

type UnderstandingDetailProps = {
  understandingId: string;
  onDeleted?: () => void;
  onWikiLinkClick?: (understandingId: string) => void;
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
}: {
  context: ContextDTO;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = contextMeta(context.medium);
  const Icon = meta.Icon;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            className="group flex w-full min-w-0 flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-left text-sm text-card-foreground transition-colors outline-none hover:bg-accent/30 active:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={onPreview}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="outline" className="gap-1">
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
                <SimpleMarkdownPreview content={context.content} lineClamp={2} />
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

export function ContextPreviewDrawerContent({ context }: { context: ContextDTO }) {
  const meta = contextMeta(context.medium);
  const Icon = meta.Icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b pb-4">
        <Badge variant="outline" className="gap-1">
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
          <MarkdownPreview content={context.content} />
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
  const { closeDrawer } = useSharedDrawer();

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
            contentKey={editorKey}
            initialContent={draft.content}
            height="100%"
            placeholder="记录这条上下文的具体内容"
            onUpdate={(content) => {
              setDraft((current) =>
                milkdownMarkdownEquals(content, current.content)
                  ? current
                  : { ...current, content },
              );
            }}
          />
        </Field>
      </FieldGroup>
      <div className="mt-4 flex shrink-0 justify-end gap-2 border-t bg-popover pt-4">
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
  onDeleted,
  onWikiLinkClick,
}: UnderstandingDetailProps) {
  const detailRef = useRef<HTMLElement>(null);
  const { understanding } = useUnderstandingDetail(understandingId);
  const { updateUnderstanding, deleteUnderstanding, createContext, updateContext, deleteContext } =
    useUnderstandingDetailActions(understandingId);
  const { confirm } = useModal();
  const { openDrawer, closeDrawer } = useSharedDrawer();
  const draft = useCaptureStore((state) =>
    state.draft?.understandingId === understandingId ? state.draft : null,
  );
  const activeContextId = useCaptureStore((state) => state.activeContextId);
  const initializeDraft = useCaptureStore((state) => state.initializeDraft);
  const updateDraftTitle = useCaptureStore((state) => state.updateDraftTitle);
  const updateDraftBody = useCaptureStore((state) => state.updateDraftBody);
  const setActiveContextId = useCaptureStore((state) => state.setActiveContextId);
  const { saveDraft } = useUnderstandingDraftSave({ understandingId, scopeRef: detailRef });

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
      <ContextPreviewDrawerContent context={context} />,
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
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{updatedLabel}</span>
            <span aria-hidden>·</span>
            <DomainTreeSelect
              modelValue={understanding.domainIds}
              onUpdateModelValue={(domainIds) => void updateUnderstanding({ domainIds })}
              placeholder="未归入 Domain"
              fluid={false}
              usePathLabel={false}
              variant="inline"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDeleteUnderstanding}
            >
              <Trash2 size={13} />
              删除
            </Button>
          </div>
          <Input
            value={title}
            onChange={(event) => {
              const next = event.target.value;
              updateDraftTitle(next);
            }}
            onBlur={() => void saveDraft()}
            className="h-auto border-0 bg-transparent px-0 py-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
            placeholder="写下一个刚形成的理解"
          />
        </header>

        <section className="mt-5">
          <MarkdownEditor
            contentKey={understanding.id}
            initialContent={understanding.body}
            height="auto"
            maxHeight="clamp(320px, 50vh, 560px)"
            placeholder="用自己的语言写下这条理解。通过 [[已有理解标题]] 连接相关理解。"
            onUpdate={(next) => {
              if (milkdownMarkdownEquals(next, body)) return;
              updateDraftBody(next);
            }}
            onBlur={() => void saveDraft()}
            onWikiLinkClick={onWikiLinkClick}
          />
        </section>

        <section className="mt-10 flex flex-col gap-3 border-t border-border/70 pt-8 pb-6">
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
  return <UnderstandingDetailInner {...props} />;
}
