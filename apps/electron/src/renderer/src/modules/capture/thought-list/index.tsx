import { FileText, GitBranch, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import {
  selectedCategoryIdAtom,
  selectedThoughtIdAtom,
  thoughtListIncludeDescendantsAtom,
  thoughtListSearchQueryAtom,
} from "../state";
import { useThoughtList, useThoughtListActions } from "./hooks";
import { ThoughtRow } from "./ThoughtRow";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { cn } from "@renderer/lib/utils";

export function ThoughtList() {
  const thoughtList = useThoughtList();
  const thoughtListActions = useThoughtListActions();
  const selectedCategoryId = useAtomValue(selectedCategoryIdAtom);
  const selectedThoughtId = useAtomValue(selectedThoughtIdAtom);
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const [searchQuery, setSearchQuery] = useAtom(thoughtListSearchQueryAtom);
  const [includeDescendants, setIncludeDescendants] = useAtom(thoughtListIncludeDescendantsAtom);
  const { categoryList } = useCategoryData();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const categoryLabel =
    selectedCategoryId === "all"
      ? "全部领域"
      : (categoryList.find((c) => c.id === selectedCategoryId)?.name ?? "");
  const hasSearchQuery = searchQuery.trim().length > 0;
  const countLabel =
    hasSearchQuery && thoughtList.displayedThoughts.length !== thoughtList.totalCount
      ? `${thoughtList.displayedThoughts.length} / ${thoughtList.totalCount} 笔记`
      : `${thoughtList.totalCount} 笔记`;

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (thoughtList.loading) return;
    const selectedIsVisible = thoughtList.displayedThoughts.some(
      (thought) => thought.id === selectedThoughtId,
    );
    if (selectedIsVisible) return;
    setSelectedThoughtId(thoughtList.displayedThoughts[0]?.id ?? null);
  }, [thoughtList.loading, thoughtList.displayedThoughts, selectedThoughtId, setSelectedThoughtId]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col border-r bg-transparent">
      <div className="space-y-3 px-3 py-3">
        <div className="flex h-8 items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{categoryLabel}</div>
            <div className="text-xs text-muted-foreground">{countLabel}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={searchOpen ? "收起搜索" : "搜索理解"}
              aria-pressed={searchOpen}
              className={cn(searchOpen && "bg-muted text-foreground")}
              onClick={() => {
                setSearchOpen((open) => {
                  if (open) setSearchQuery("");
                  return !open;
                });
              }}
            >
              <Search size={14} />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={includeDescendants ? "已包含子领域" : "未包含子领域"}
              aria-pressed={includeDescendants}
              className={cn(includeDescendants && "bg-muted text-foreground")}
              onClick={() => setIncludeDescendants(!includeDescendants)}
            >
              <GitBranch size={14} />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="新建理解"
              onClick={() => void thoughtListActions.createEmptyUnderstanding()}
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>
        {searchOpen && (
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="查找已有理解"
          />
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 px-2 pb-3">
          {thoughtList.displayedThoughts.map((thought) => (
            <ThoughtRow
              key={thought.id}
              thought={thought}
              selected={thought.id === selectedThoughtId}
            />
          ))}
          {thoughtList.displayedThoughts.length === 0 && (
            <Empty>
              <EmptyContent>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyDescription>
                  {hasSearchQuery ? "没有找到相关内容" : "暂时没有内容"}
                </EmptyDescription>
              </EmptyContent>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
