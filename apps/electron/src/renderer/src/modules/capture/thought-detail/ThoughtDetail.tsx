import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@renderer/components/ui/native-select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@renderer/components/ui/sheet";
import { Textarea } from "@renderer/components/ui/textarea";
import { CategoryTreeSelect } from "@renderer/modules/shared/biz-components/CategoryTreeSelect";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { ipcClient } from "@renderer/utils/ipc";
import type { ContextDTO, SourceType } from "@shared/context";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowLeft, ArrowRight, ExternalLink, Plus, Trash2 } from "lucide-react";
import { debounce } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { useCapturePageContext } from "../context";
import { ThoughtDetailProvider, useThoughtDetailContext } from "./context";
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
    <div className="group rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 transition-colors hover:border-border/70 hover:bg-muted/35">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant="outline"
            className="h-5 rounded-md border-border/50 px-1.5 text-[11px] font-normal text-muted-foreground"
          >
            <Icon size={11} />
            {meta.label}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/90">
            {source.sourceName?.trim() || meta.label}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {source.content.length} 字
          </span>
        </div>
        <div className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {source.content ? (
            <SimpleMarkdownPreview content={source.content} lineClamp={2} />
          ) : (
            <span className="text-muted-foreground/55">空来源，可以直接补充内容。</span>
          )}
        </div>
      </button>
      <div className="mt-2 hidden justify-end group-hover:flex">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={onDelete}
        >
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
    <button
      type="button"
      className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-left transition-colors hover:border-border/70 hover:bg-muted/35"
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Badge
          variant="outline"
          className="h-5 rounded-md px-1.5 text-[11px] font-normal text-muted-foreground"
        >
          <Icon size={11} />
          {label}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/90">
          {titleForThought(thought)}
        </span>
        <ExternalLink size={13} className="shrink-0 text-muted-foreground" />
      </div>
      {thought.body && (
        <div className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
          <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
        </div>
      )}
    </button>
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

  const debouncedUpdate = useMemo(
    () =>
      debounce((id: string, input: SourceUpdateInput) => {
        onUpdate(id, input);
      }, 350),
    [onUpdate],
  );

  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

  if (!source) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(720px,56vw)] max-w-none bg-card shadow-xl">
        <SheetHeader className="border-b border-border/50 px-5 py-4">
          <SheetTitle className="text-sm font-medium text-muted-foreground">来源详情</SheetTitle>
          <div className="flex min-w-0 items-center gap-2 pt-2">
            <NativeSelect
              size="sm"
              value={sourceType}
              onChange={(event) => {
                const next = event.target.value as SourceType;
                setSourceType(next);
                onUpdate(source.id, { sourceType: next });
              }}
            >
              {SOURCE_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {sourceLabel(type)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Input
              value={sourceName}
              onChange={(event) => {
                const next = event.target.value;
                setSourceName(next);
                debouncedUpdate(source.id, { sourceName: next });
              }}
              placeholder="来源名称或场景"
              className="h-8 border-transparent bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
            />
          </div>
          <div className="text-xs tabular-nums text-muted-foreground">{content.length} 字</div>
        </SheetHeader>
        <div className="capture-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <Textarea
            value={content}
            onChange={(event) => {
              const next = event.target.value;
              setContent(next);
              debouncedUpdate(source.id, { content: next });
            }}
            placeholder="记录这条来源的具体内容"
            className="min-h-[calc(100vh-160px)] resize-none border-transparent bg-transparent px-0 py-4 text-sm leading-7 shadow-none focus-visible:border-transparent focus-visible:ring-0"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ThoughtDetailInner({ thoughtId, onDeleted }: ThoughtDetailProps) {
  const capture = useCapturePageContext();
  const { thought, updateThought, createContext, updateContext, deleteContext } =
    useThoughtDetailContext();
  const { confirm } = useModal();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  useEffect(() => setTitle(thought?.title ?? ""), [thought?.id, thought?.title]);
  useEffect(() => setBody(thought?.body ?? ""), [thought?.id, thought?.body]);

  const debouncedTitleUpdate = useMemo(
    () =>
      debounce((value: string) => {
        void updateThought({ title: value || null });
      }, 350),
    [updateThought],
  );

  const debouncedBodyUpdate = useMemo(
    () =>
      debounce((value: string) => {
        void updateThought({ body: value });
      }, 350),
    [updateThought],
  );

  useEffect(
    () => () => {
      debouncedTitleUpdate.cancel();
      debouncedBodyUpdate.cancel();
    },
    [debouncedTitleUpdate, debouncedBodyUpdate],
  );

  if (!thought) {
    return <div className="h-full bg-background" />;
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
    <div className="h-full overflow-hidden bg-background">
      <div className="capture-scroll h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-10 py-8">
          <header className="flex flex-col gap-3 border-b border-border/45 pb-5">
            <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
              <span>{updatedLabel}</span>
              <span>·</span>
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
                className="ml-auto h-7 px-2 text-xs text-muted-foreground"
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
              placeholder="写下一个刚形成的理解"
              className="h-auto border-transparent bg-transparent px-0 py-0 text-[1.625rem] font-semibold leading-tight tracking-normal text-foreground shadow-none placeholder:text-muted-foreground/55 focus-visible:border-transparent focus-visible:ring-0"
            />
          </header>

          <section>
            <Textarea
              value={body}
              onChange={(event) => {
                const next = event.target.value;
                setBody(next);
                debouncedBodyUpdate(next);
              }}
              placeholder="用自己的语言写下这条理解。通过 [[已有理解标题]] 连接相关理解。"
              className="min-h-[300px] resize-none border-transparent bg-transparent px-0 py-0 text-[1.0625rem] leading-[1.85] text-foreground shadow-none placeholder:text-muted-foreground/55 focus-visible:border-transparent focus-visible:ring-0"
            />
          </section>

          <section className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">来源</div>
                <div className="text-xs text-muted-foreground">这条理解从哪里长出来</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => void handleAddSource()}
              >
                <Plus size={14} />
                添加来源
              </Button>
            </div>
            {thought.contexts.length > 0 ? (
              <div className="flex flex-col gap-2">
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
              <button
                type="button"
                className="rounded-lg border border-dashed border-border/60 bg-transparent px-3 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                onClick={() => void handleAddSource()}
              >
                添加来源
              </button>
            )}
          </section>

          <section className="flex flex-col gap-2 pb-8">
            <div>
              <div className="text-sm font-medium text-foreground">双链关系</div>
              <div className="text-xs text-muted-foreground">关系只来自正文中的双链</div>
            </div>

            {thought.connections.length === 0 &&
            thought.referencedBy.length === 0 &&
            unresolvedLinks.length === 0 ? (
              <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                暂时独立
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {thought.connections.map((item) => (
                  <RelationItem
                    key={`out-${item.id}`}
                    thought={item}
                    direction="outgoing"
                    onSelect={() => {
                      capture.setSelectedThoughtId(item.id);
                      capture.setSelectedCategoryId(item.categoryIds[0] ?? "all");
                    }}
                  />
                ))}
                {thought.referencedBy.map((item) => (
                  <RelationItem
                    key={`in-${item.id}`}
                    thought={item}
                    direction="incoming"
                    onSelect={() => {
                      capture.setSelectedThoughtId(item.id);
                      capture.setSelectedCategoryId(item.categoryIds[0] ?? "all");
                    }}
                  />
                ))}
                {unresolvedLinks.map((link) => (
                  <div
                    key={link}
                    className="rounded-lg border border-dashed border-border/60 bg-transparent px-3 py-2 text-sm text-muted-foreground"
                  >
                    未解析：[[{link}]]
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

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
  return (
    <ThoughtDetailProvider thoughtId={props.thoughtId}>
      <ThoughtDetailInner {...props} />
    </ThoughtDetailProvider>
  );
}
