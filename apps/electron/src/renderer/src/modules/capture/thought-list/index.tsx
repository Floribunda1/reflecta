import { useVirtualizer } from "@tanstack/react-virtual";
import { FileText, GitBranch, Plus, Search, ArrowUpDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { useThoughtList, useThoughtListActions } from "./hooks";
import { ThoughtRow } from "./ThoughtRow";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { cn } from "@renderer/lib/utils";
import { useCaptureStore } from "../store";
import { useCaptureCategories } from "../queries";
import type { ThoughtListSortBy } from "./sort";

export function ThoughtList() {
  const thoughtList = useThoughtList();
  const thoughtListActions = useThoughtListActions();
  const selectedCategoryId = useCaptureStore((state) => state.selectedCategoryId);
  const selectedThoughtId = useCaptureStore((state) => state.selectedThoughtId);
  const searchOpen = useCaptureStore((state) => state.searchOpen);
  const searchQuery = useCaptureStore((state) => state.searchQuery);
  const includeDescendants = useCaptureStore((state) => state.includeDescendants);
  const setSearchOpen = useCaptureStore((state) => state.setSearchOpen);
  const setSearchQuery = useCaptureStore((state) => state.setSearchQuery);
  const setIncludeDescendants = useCaptureStore((state) => state.setIncludeDescendants);
  const thoughtListSortBy = useCaptureStore((state) => state.thoughtListSortBy);
  const setThoughtListSortBy = useCaptureStore((state) => state.setThoughtListSortBy);
  const { categoryList } = useCaptureCategories();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const thoughts = thoughtList.displayedThoughts;

  const virtualizer = useVirtualizer({
    count: thoughts.length,
    getScrollElement: () => listViewportRef.current,
    estimateSize: () => 108,
    gap: 4,
    overscan: 8,
  });

  const categoryLabel =
    selectedCategoryId === "all"
      ? "全部领域"
      : (categoryList.find((c) => c.id === selectedCategoryId)?.name ?? "");
  const hasSearchQuery = searchQuery.trim().length > 0;
  const countLabel =
    hasSearchQuery && thoughts.length !== thoughtList.totalCount
      ? `${thoughts.length} / ${thoughtList.totalCount} 笔记`
      : `${thoughtList.totalCount} 笔记`;

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!selectedThoughtId || thoughts.length === 0) return;

    const selectedIndex = thoughts.findIndex((thought) => thought.id === selectedThoughtId);
    if (selectedIndex < 0) return;

    virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
  }, [selectedThoughtId, thoughts, virtualizer]);

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
              onClick={() => setSearchOpen(!searchOpen)}
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="排序笔记"
                    className={cn(thoughtListSortBy === "createdAt" && "bg-muted text-foreground")}
                  >
                    <ArrowUpDown size={14} />
                  </Button>
                }
              />
              <DropdownMenuContent side="bottom" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>排序</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={thoughtListSortBy}
                    onValueChange={(value) => setThoughtListSortBy(value as ThoughtListSortBy)}
                  >
                    <DropdownMenuRadioItem value="updatedAt">按更新时间</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="createdAt">按创建时间</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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

      {thoughts.length === 0 ? (
        <div className="min-h-0 flex-1 px-2 pb-3">
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
        </div>
      ) : (
        <div ref={listViewportRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const thought = thoughts[virtualRow.index];
              if (!thought) return null;

              return (
                <div
                  key={thought.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <ThoughtRow thought={thought} selected={thought.id === selectedThoughtId} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
