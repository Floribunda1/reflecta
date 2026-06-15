import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@renderer/components/ui/field";
import { Input } from "@renderer/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@renderer/components/ui/tabs";
import { CategoryTreeSelect } from "@renderer/modules/shared/biz-components/CategoryTreeSelect";
import { MarkdownEditor } from "@renderer/modules/shared/components/markdown-editor/editor";
import { milkdownMarkdownEquals } from "@renderer/modules/shared/components/markdown-editor/editor/markdown-normalize";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";
import { useSharedDrawer } from "@renderer/modules/shared/hooks/use-drawer";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import type { ContextDTO, SourceType } from "@shared/context";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useThoughtDetail, useThoughtDetailActions } from "./hooks";
import { SOURCE_META, SOURCE_PLACEHOLDER, SOURCE_TYPES } from "./context/types";
import { useCaptureStore } from "../store";
import { useThoughtDraftSave } from "../useThoughtDraftSave";

type ThoughtDetailProps = {
  thoughtId: string;
  onDeleted?: () => void;
};

type SourceDraftInput = {
  sourceType: SourceType;
  sourceName: string;
  content: string;
};

const SOURCE_DRAWER_WIDTH_CLASS =
  "data-[side=right]:w-[min(760px,calc(100vw-2rem))] data-[side=right]:sm:max-w-none";

function sourceLabel(type: SourceType): string {
  return SOURCE_META[type].label;
}

function createEmptySourceDraft(): SourceDraftInput {
  return {
    sourceType: "experience",
    sourceName: "",
    content: "",
  };
}

function createSourceDraft(source: ContextDTO | null): SourceDraftInput {
  if (!source) return createEmptySourceDraft();
  return {
    sourceType: source.sourceType,
    sourceName: source.sourceName ?? "",
    content: source.content,
  };
}

function SourcePreview({
  source,
  onOpen,
  onDelete,
}: {
  source: ContextDTO;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const meta = SOURCE_META[source.sourceType];
  const Icon = meta.Icon;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2 text-sm">
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-w-0 justify-start px-2 py-1.5 text-left"
        onClick={onOpen}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Icon size={11} />
              {meta.label}
            </Badge>
            <span className="min-w-0 flex-1 truncate font-medium">
              {source.sourceName?.trim() || meta.label}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {source.content.length} 字
            </span>
          </div>
          <div className="mt-2 text-muted-foreground">
            {source.content ? (
              <SimpleMarkdownPreview content={source.content} lineClamp={2} />
            ) : (
              <span>空来源，可以直接补充内容。</span>
            )}
          </div>
        </div>
      </Button>
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 size={13} />
          删除
        </Button>
      </div>
    </div>
  );
}

function SourceDetailDrawerContent({
  source,
  creating,
  editorKey,
  onSave,
}: {
  source: ContextDTO | null;
  creating: boolean;
  editorKey: string;
  onSave: (input: SourceDraftInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SourceDraftInput>(() => createSourceDraft(source));
  const [saving, setSaving] = useState(false);
  const { closeDrawer } = useSharedDrawer();

  if (!creating && !source) return null;

  const sourceTypePlaceholder = SOURCE_PLACEHOLDER[draft.sourceType] || "来源名称或场景";

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
          <FieldLabel>来源类型</FieldLabel>
          <Tabs
            value={draft.sourceType}
            onValueChange={(value) =>
              setDraft((current) => ({ ...current, sourceType: value as SourceType }))
            }
          >
            <TabsList>
              {SOURCE_TYPES.map((type) => {
                const meta = SOURCE_META[type];
                const Icon = meta.Icon;
                return (
                  <TabsTrigger key={type} value={type}>
                    <Icon size={14} />
                    {sourceLabel(type)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </Field>

        <Field>
          <FieldLabel>来源名称</FieldLabel>
          <Input
            value={draft.sourceName}
            onChange={(event) => {
              const sourceName = event.target.value;
              setDraft((current) => ({ ...current, sourceName }));
            }}
            placeholder={sourceTypePlaceholder}
          />
        </Field>

        <Field className="min-h-0 flex-1">
          <FieldLabel>来源内容</FieldLabel>
          <FieldDescription>{draft.content.length} 字</FieldDescription>
          <MarkdownEditor
            contentKey={editorKey}
            initialContent={draft.content}
            height="100%"
            placeholder="记录这条来源的具体内容"
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

function ThoughtDetailInner({ thoughtId, onDeleted }: ThoughtDetailProps) {
  const detailRef = useRef<HTMLElement>(null);
  const { thought } = useThoughtDetail(thoughtId);
  const { updateThought, deleteThought, createContext, updateContext, deleteContext } =
    useThoughtDetailActions(thoughtId);
  const { confirm } = useModal();
  const { openDrawer, closeDrawer } = useSharedDrawer();
  const draft = useCaptureStore((state) =>
    state.draft?.thoughtId === thoughtId ? state.draft : null,
  );
  const activeSourceId = useCaptureStore((state) => state.activeSourceId);
  const initializeDraft = useCaptureStore((state) => state.initializeDraft);
  const updateDraftTitle = useCaptureStore((state) => state.updateDraftTitle);
  const updateDraftBody = useCaptureStore((state) => state.updateDraftBody);
  const setActiveSourceId = useCaptureStore((state) => state.setActiveSourceId);
  const { saveDraft } = useThoughtDraftSave({ thoughtId, scopeRef: detailRef });

  useEffect(() => {
    if (!thought) return;
    initializeDraft({
      thoughtId: thought.id,
      title: thought.title ?? "",
      body: thought.body,
    });
  }, [thought?.id, thought?.title, thought?.body, initializeDraft]);

  if (!thought) {
    return <div className="h-full" />;
  }

  const title = draft?.title ?? thought.title ?? "";
  const body = draft?.body ?? thought.body;
  const updatedLabel = formatDistanceToNow(thought.updatedAt, {
    addSuffix: true,
    locale: zhCN,
  });

  const handleDeleteThought = () => {
    confirm({
      title: "删除理解",
      message: "确定要删除这条理解吗？此操作不可撤销。",
      acceptLabel: "删除",
      danger: true,
      onAccept: async () => {
        await deleteThought();
        onDeleted?.();
      },
    });
  };

  const openSourceDrawer = (source: ContextDTO | null) => {
    const sourceId = source?.id ?? null;
    const creating = sourceId === null;
    if (sourceId) {
      setActiveSourceId(sourceId);
    } else {
      setActiveSourceId(null);
    }

    openDrawer(
      {
        title: creating ? "添加来源" : "来源详情",
        widthClassName: SOURCE_DRAWER_WIDTH_CLASS,
        onClose: () => setActiveSourceId(null),
      },
      <SourceDetailDrawerContent
        source={source}
        creating={creating}
        editorKey={sourceId ?? "source-new"}
        onSave={async (input) => {
          if (creating) {
            await createContext({
              sourceType: input.sourceType,
              sourceName: input.sourceName,
              content: input.content,
            });
            return;
          }

          await updateContext(sourceId, {
            sourceType: input.sourceType,
            sourceName: input.sourceName,
            content: input.content,
          });
        }}
      />,
    );
  };

  const handleAddSource = () => {
    openSourceDrawer(null);
  };

  const handleDeleteSource = (source: ContextDTO) => {
    confirm({
      title: "删除来源",
      message: "确定要删除这条来源吗？此操作不可撤销。",
      acceptLabel: "删除",
      danger: true,
      onAccept: async () => {
        await deleteContext(source.id);
        if (activeSourceId === source.id) {
          setActiveSourceId(null);
          closeDrawer();
        }
      },
    });
  };

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <article ref={detailRef} className="mx-auto h-full overflow-y-auto px-6 py-5">
        <header className="space-y-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{updatedLabel}</span>
            <span aria-hidden>·</span>
            <CategoryTreeSelect
              modelValue={thought.categoryIds}
              onUpdateModelValue={(categoryIds) => void updateThought({ categoryIds })}
              placeholder="未归类"
              fluid={false}
              usePathLabel={false}
              variant="inline"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDeleteThought}
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
            contentKey={thought.id}
            initialContent={thought.body}
            height="auto"
            maxHeight="clamp(320px, 50vh, 560px)"
            placeholder="用自己的语言写下这条理解。通过 [[已有理解标题]] 连接相关理解。"
            onUpdate={(next) => {
              if (milkdownMarkdownEquals(next, body)) return;
              updateDraftBody(next);
            }}
            onBlur={() => void saveDraft()}
          />
        </section>

        <section className="mt-10 flex flex-col gap-3 border-t border-border/70 pt-8 pb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">来源</div>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={handleAddSource}>
              <Plus size={14} />
              添加来源
            </Button>
          </div>
          {thought.contexts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {thought.contexts.map((source) => (
                <SourcePreview
                  key={source.id}
                  source={source}
                  onOpen={() => openSourceDrawer(source)}
                  onDelete={() => handleDeleteSource(source)}
                />
              ))}
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start border-dashed p-4 text-muted-foreground"
              onClick={handleAddSource}
            >
              添加来源
            </Button>
          )}
        </section>
      </article>
    </div>
  );
}

export function ThoughtDetail(props: ThoughtDetailProps) {
  return <ThoughtDetailInner {...props} />;
}
