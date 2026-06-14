import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Empty, EmptyContent, EmptyDescription } from "@renderer/components/ui/empty";
import { Input } from "@renderer/components/ui/input";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@renderer/components/ui/sheet";
import { Textarea } from "@renderer/components/ui/textarea";
import { CategoryTreeSelect } from "@renderer/modules/shared/biz-components/CategoryTreeSelect";
import { MarkdownEditor } from "@renderer/modules/shared/components/md-editor";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { ipcClient } from "@renderer/utils/ipc";
import type { ContextDTO, SourceType } from "@shared/context";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft, ArrowRight, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useDebounceFn } from "ahooks";
import { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { selectedCategoryIdAtom, selectedThoughtIdAtom } from "../state";
import { useThoughtDetail, useThoughtDetailActions } from "./hooks";
import { SOURCE_META, SOURCE_TYPES } from "./context/types";

type ThoughtDetailProps = {
  thoughtId: string;
  onDeleted?: () => void;
};

type SourceUpdateInput = {
  sourceType?: SourceType;
  sourceName?: string;
  content?: string;
};

const wikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;

function titleForThought(thought: { title: string | null; body: string }): string {
  const title = thought.title?.trim();
  if (title) return title;
  const firstLine = thought.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || "未命名理解";
}

function sourceLabel(type: SourceType): string {
  return SOURCE_META[type].label;
}

function getUnresolvedWikiLinks(body: string, resolvedTargets: ThoughtSummaryDTO[]): string[] {
  const resolved = new Set<string>();
  for (const target of resolvedTargets) {
    resolved.add(target.id);
    if (target.title) resolved.add(target.title);
  }

  const unresolved = new Set<string>();
  for (const match of body.matchAll(wikiLinkPattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    const target = raw.includes("#") ? raw.slice(raw.lastIndexOf("#") + 1).trim() : raw;
    if (!target || resolved.has(target)) continue;
    unresolved.add(raw);
  }
  return [...unresolved];
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

function RelationItem({
  thought,
  direction,
  onSelect,
}: {
  thought: ThoughtSummaryDTO;
  direction: "outgoing" | "incoming";
  onSelect: () => void;
}) {
  const Icon = direction === "outgoing" ? ArrowRight : ArrowLeft;
  const label = direction === "outgoing" ? "引用了" : "被引用";

  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto w-full justify-start p-3 text-left"
      onClick={onSelect}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Icon size={11} />
            {label}
          </Badge>
          <span className="min-w-0 flex-1 truncate font-medium">{titleForThought(thought)}</span>
          <ExternalLink size={13} className="shrink-0 text-muted-foreground" />
        </div>
        {thought.body && (
          <div className="text-muted-foreground">
            <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
          </div>
        )}
      </div>
    </Button>
  );
}

function SourceDetailOverlay({
  source,
  open,
  onOpenChange,
  onUpdate,
}: {
  source: ContextDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, input: SourceUpdateInput) => void;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("experience");
  const [sourceName, setSourceName] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!source) return;
    setSourceType(source.sourceType);
    setSourceName(source.sourceName ?? "");
    setContent(source.content);
  }, [source?.id, source?.sourceType, source?.sourceName, source?.content]);

  const { run: debouncedUpdate, cancel: cancelDebouncedUpdate } = useDebounceFn(
    (id: string, input: SourceUpdateInput) => {
      onUpdate(id, input);
    },
    { wait: 350 },
  );

  useEffect(() => () => cancelDebouncedUpdate(), [cancelDebouncedUpdate]);

  if (!source) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader className="gap-3 border-b">
          <SheetTitle>来源详情</SheetTitle>
          <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-2">
            <Select
              value={sourceType}
              onValueChange={(value) => {
                const next = value as SourceType;
                setSourceType(next);
                onUpdate(source.id, { sourceType: next });
              }}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {sourceLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={sourceName}
              onChange={(event) => {
                const next = event.target.value;
                setSourceName(next);
                debouncedUpdate(source.id, { sourceName: next });
              }}
              placeholder="来源名称或场景"
            />
          </div>
          <div className="text-xs text-muted-foreground">{content.length} 字</div>
        </SheetHeader>
        <div className="min-h-0 flex-1 px-4 pb-4">
          <Textarea
            value={content}
            onChange={(event) => {
              const next = event.target.value;
              setContent(next);
              debouncedUpdate(source.id, { content: next });
            }}
            className="h-full min-h-[calc(100vh-11rem)] resize-none"
            placeholder="记录这条来源的具体内容"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ThoughtDetailInner({ thoughtId, onDeleted }: ThoughtDetailProps) {
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const setSelectedCategoryId = useSetAtom(selectedCategoryIdAtom);
  const { thought } = useThoughtDetail(thoughtId);
  const { updateThought, createContext, updateContext, deleteContext } =
    useThoughtDetailActions(thoughtId);
  const { confirm } = useModal();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  useEffect(() => setTitle(thought?.title ?? ""), [thought?.id, thought?.title]);
  useEffect(() => setBody(thought?.body ?? ""), [thought?.id, thought?.body]);

  const { run: debouncedTitleUpdate, cancel: cancelTitleUpdate } = useDebounceFn(
    (value: string) => {
      void updateThought({ title: value || null });
    },
    { wait: 350 },
  );

  const { run: debouncedBodyUpdate, cancel: cancelBodyUpdate } = useDebounceFn(
    (value: string) => {
      void updateThought({ body: value });
    },
    { wait: 350 },
  );

  useEffect(
    () => () => {
      cancelTitleUpdate();
      cancelBodyUpdate();
    },
    [cancelTitleUpdate, cancelBodyUpdate],
  );

  if (!thought) {
    return <div className="h-full" />;
  }

  const activeSource = thought.contexts.find((source) => source.id === activeSourceId) ?? null;
  const unresolvedLinks = getUnresolvedWikiLinks(thought.body, thought.connections);
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
        await ipcClient.thought.deleteThought(thoughtId);
        onDeleted?.();
      },
    });
  };

  const handleAddSource = async () => {
    const created = await createContext({
      sourceType: "experience",
      sourceName: "",
      content: "",
    });
    setActiveSourceId(created.id);
  };

  const handleDeleteSource = (source: ContextDTO) => {
    confirm({
      title: "删除来源",
      message: "确定要删除这条来源吗？此操作不可撤销。",
      acceptLabel: "删除",
      danger: true,
      onAccept: async () => {
        await deleteContext(source.id);
        if (activeSourceId === source.id) setActiveSourceId(null);
      },
    });
  };

  return (
    <div className="h-full min-h-0 min-w-0">
      <ScrollArea className="h-full">
        <article className="mx-auto flex min-h-full flex-col px-6 py-5">
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
                setTitle(next);
                debouncedTitleUpdate(next);
              }}
              className="h-auto border-0 bg-transparent px-0 py-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
              placeholder="写下一个刚形成的理解"
            />
          </header>

          <section className="mt-5">
            <MarkdownEditor
              contentKey={thought.id}
              initialContent={thought.body}
              height="clamp(320px, 46vh, 520px)"
              placeholder="用自己的语言写下这条理解。通过 [[已有理解标题]] 连接相关理解。"
              onUpdate={(next) => {
                if (next === body) return;
                setBody(next);
                debouncedBodyUpdate(next);
              }}
            />
          </section>

          <section className="mt-8 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">来源</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void handleAddSource()}
              >
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
                    onOpen={() => setActiveSourceId(source.id)}
                    onDelete={() => handleDeleteSource(source)}
                  />
                ))}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start border-dashed p-4 text-muted-foreground"
                onClick={() => void handleAddSource()}
              >
                添加来源
              </Button>
            )}
          </section>

          <section className="mt-8 flex flex-col gap-3 pb-6">
            <div>
              <div className="text-sm font-medium">双链关系</div>
            </div>

            {thought.connections.length === 0 &&
            thought.referencedBy.length === 0 &&
            unresolvedLinks.length === 0 ? (
              <Empty className="min-h-20 flex-none p-4">
                <EmptyContent>
                  <EmptyDescription>暂时独立</EmptyDescription>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="flex flex-col gap-3">
                {thought.connections.map((item) => (
                  <RelationItem
                    key={`out-${item.id}`}
                    thought={item}
                    direction="outgoing"
                    onSelect={() => {
                      setSelectedThoughtId(item.id);
                      setSelectedCategoryId(item.categoryIds[0] ?? "all");
                    }}
                  />
                ))}
                {thought.referencedBy.map((item) => (
                  <RelationItem
                    key={`in-${item.id}`}
                    thought={item}
                    direction="incoming"
                    onSelect={() => {
                      setSelectedThoughtId(item.id);
                      setSelectedCategoryId(item.categoryIds[0] ?? "all");
                    }}
                  />
                ))}
                {unresolvedLinks.map((link) => (
                  <div
                    key={link}
                    className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground"
                  >
                    未解析：[[{link}]]
                  </div>
                ))}
              </div>
            )}
          </section>
        </article>
      </ScrollArea>

      <SourceDetailOverlay
        source={activeSource}
        open={activeSource !== null}
        onOpenChange={(open) => {
          if (!open) setActiveSourceId(null);
        }}
        onUpdate={(id, input) => {
          void updateContext(id, input);
        }}
      />
    </div>
  );
}

export function ThoughtDetail(props: ThoughtDetailProps) {
  return <ThoughtDetailInner {...props} />;
}
