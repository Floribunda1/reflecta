import { Badge } from "@renderer/components/ui/badge";
import { semanticBadgeClass } from "@renderer/lib/badge-colors";
import { Input } from "@renderer/components/ui/input";
import { Kbd } from "@renderer/components/ui/kbd";
import { KeyboardEvent, useMemo, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Link, Lightbulb, Loader2, Search, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import { searchEventBus } from "@renderer/utils/searchEventBus";
import type { ThoughtSummaryDTO, ThoughtType } from "@shared/thought";
import type { FtsContextResult } from "@shared/search";
import { SimpleMarkdownPreview } from "../components/md-preview";
import { useModal } from "../hooks/use-modal";

type SuggestionItem =
  | { kind: "thought"; data: ThoughtSummaryDTO }
  | { kind: "context"; data: FtsContextResult };

const TYPE_CONFIG: Record<
  ThoughtType,
  { label: string; Icon: typeof Lightbulb; color: "warning" | "accent" }
> = {
  idea: {
    label: "Idea",
    Icon: Lightbulb,
    color: "warning",
  },
  insight: {
    label: "Insight",
    Icon: Sparkles,
    color: "accent",
  },
};

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResult, isFetching } = useQuery({
    queryKey: ["search", searchQuery] as const,
    queryFn: () => ipcClient.search.search(searchQuery),
    enabled: searchQuery.length > 0,
  });

  const results = useMemo<SuggestionItem[]>(() => {
    if (!searchResult) return [];
    return [
      ...searchResult.thoughts.map((t) => ({ kind: "thought" as const, data: t })),
      ...searchResult.contexts.map((c) => ({ kind: "context" as const, data: c })),
    ];
  }, [searchResult]);

  const handleSelect = (item: SuggestionItem) => {
    if (item.kind === "thought") {
      searchEventBus.emit("thoughtSelected", {
        thoughtId: item.data.id,
        categoryIds: item.data.categoryIds,
      });
    } else {
      searchEventBus.emit("thoughtSelected", {
        thoughtId: item.data.thoughtId,
        categoryIds: undefined,
      });
    }
    onClose();
  };

  const handleKeydown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setSearchQuery(inputValue.trim());
    }
  };

  const renderThought = (thought: ThoughtSummaryDTO) => {
    const cfg = TYPE_CONFIG[thought.type];
    const Icon = cfg.Icon;
    return (
      <div
        key={`thought-${thought.id}`}
        className="cursor-pointer border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted"
        onClick={() => handleSelect({ kind: "thought", data: thought })}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary" className={semanticBadgeClass[cfg.color]}>
            <Icon size={12} />
            {cfg.label}
          </Badge>
          {thought.title && (
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {thought.title}
            </span>
          )}
        </div>
        <div className="mt-1 min-w-0 overflow-hidden text-[13px] leading-5 text-muted-foreground">
          {thought.body ? (
            <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
          ) : (
            !thought.title && <span className="italic text-muted-foreground">无内容</span>
          )}
        </div>
      </div>
    );
  };

  const renderContext = (ctx: FtsContextResult) => (
    <div
      key={`context-${ctx.contextId}`}
      className="cursor-pointer border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted"
      onClick={() => handleSelect({ kind: "context", data: ctx })}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant="secondary">
          <Link size={12} />
          Context
        </Badge>
        {ctx.sourceName && (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {ctx.sourceName}
          </span>
        )}
      </div>
      <div
        className="mt-1 min-w-0 overflow-hidden text-[13px] leading-5 text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: ctx.snippet }}
      />
    </div>
  );

  return (
    <div className="flex max-h-[72vh] flex-col">
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeydown}
            placeholder="搜索 Thought 或 Context"
            aria-label="搜索 Thought 或 Context"
            className="min-w-0 flex-1"
            autoFocus
          />
          <Kbd className="shrink-0">Enter</Kbd>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isFetching && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" size={16} />
            搜索中...
          </div>
        )}

        {!isFetching && searchQuery && results.length === 0 && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            未找到匹配结果
          </div>
        )}

        {!searchQuery && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            输入关键词后按 Enter
          </div>
        )}

        {results.length > 0 && (
          <div className="flex flex-col">
            {results.map((item) =>
              item.kind === "thought" ? renderThought(item.data) : renderContext(item.data),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function GlobalSearch() {
  const { openModal, closeModal } = useModal();

  return (
    <Button
      type="button"
      aria-label="搜索"
      size="icon-sm"
      variant="ghost"
      onClick={() =>
        openModal(<SearchDialog onClose={closeModal} />, {
          title: "搜索",
          widthClassName: "max-w-[720px]",
        })
      }
    >
      <Search size={17} />
    </Button>
  );
}
