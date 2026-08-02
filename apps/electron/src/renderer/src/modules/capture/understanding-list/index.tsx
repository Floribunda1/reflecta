import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, FileText, GitBranch, Plus, Search, Share2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useUnderstandingList, useUnderstandingListActions } from "./hooks";
import { UnderstandingRow } from "./UnderstandingRow";
import { Button } from "@reflecta/ui/components/button";
import { Input } from "@reflecta/ui/components/input";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@reflecta/ui/components/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import { cn } from "@reflecta/ui/lib/utils";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import { useCaptureDomains } from "../queries";
import type { UnderstandingListSortBy } from "./sort";
import { SidebarToggleButton } from "@renderer/modules/shared/layout/SidebarToggleButton";

export function UnderstandingList({
  onChat,
  onExpandSidebar,
}: {
  onChat?: (scope: CaptureAgentScope) => void;
  onExpandSidebar?: () => void;
}) {
  const understandingList = useUnderstandingList();
  const understandingListActions = useUnderstandingListActions();
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const searchOpen = useCaptureStore((state) => state.searchOpen);
  const searchQuery = useCaptureStore((state) => state.searchQuery);
  const includeDescendants = useCaptureStore((state) => state.includeDescendants);
  const setSearchOpen = useCaptureStore((state) => state.setSearchOpen);
  const setSearchQuery = useCaptureStore((state) => state.setSearchQuery);
  const setIncludeDescendants = useCaptureStore((state) => state.setIncludeDescendants);
  const toggleKnowledgeWander = useCaptureStore((state) => state.toggleKnowledgeWander);
  const understandingListSortBy = useCaptureStore((state) => state.understandingListSortBy);
  const setUnderstandingListSortBy = useCaptureStore((state) => state.setUnderstandingListSortBy);
  const { domainList } = useCaptureDomains();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const understandings = understandingList.displayedUnderstandings;

  const virtualizer = useVirtualizer({
    count: understandings.length,
    getScrollElement: () => listViewportRef.current,
    estimateSize: () => 108,
    gap: 4,
    overscan: 8,
  });

  const domainLabel =
    selectedDomainId === "all"
      ? "全部领域"
      : (domainList.find((c) => c.id === selectedDomainId)?.name ?? "");
  const hasSearchQuery = searchQuery.trim().length > 0;
  const countLabel =
    hasSearchQuery && understandings.length !== understandingList.totalCount
      ? `${understandings.length} / ${understandingList.totalCount} 条理解`
      : `${understandingList.totalCount} 条理解`;

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!selectedUnderstandingId || understandings.length === 0) return;

    const selectedIndex = understandings.findIndex(
      (understanding) => understanding.id === selectedUnderstandingId,
    );
    if (selectedIndex < 0) return;

    virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
  }, [selectedUnderstandingId, understandings, virtualizer]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-transparent">
      <div className="space-y-3 px-3 pl-4 py-3">
        <header
          data-testid="capture-understanding-list-header"
          className={cn("flex h-8 items-center gap-2", onExpandSidebar && "pl-[75px]")}
        >
          {onExpandSidebar ? (
            <SidebarToggleButton
              expanded={false}
              label="展开 Domain Tree"
              testId="capture-sidebar-expand-button"
              onClick={onExpandSidebar}
            />
          ) : null}
          <div className="app-drag-region flex min-w-0 items-center gap-2 self-stretch">
            <div className="truncate text-sm font-medium">{domainLabel}</div>
            <div className="shrink-0 text-xs text-muted-foreground">{countLabel}</div>
          </div>
          <div className="app-drag-region min-w-0 flex-1 self-stretch" />
          <div
            data-testid="capture-understanding-list-actions"
            className="flex shrink-0 items-center gap-1"
            data-no-drag
          >
            <Button
              data-testid="capture-knowledge-wander-entry"
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="打开知识漫步"
              className="shrink-0"
              onClick={toggleKnowledgeWander}
            >
              <Share2 size={14} />
            </Button>
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
                    aria-label="排序理解"
                    className={cn(
                      understandingListSortBy === "createdAt" && "bg-muted text-foreground",
                    )}
                  >
                    <ArrowUpDown size={14} />
                  </Button>
                }
              />
              <DropdownMenuContent side="bottom" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>排序</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={understandingListSortBy}
                    onValueChange={(value) =>
                      setUnderstandingListSortBy(value as UnderstandingListSortBy)
                    }
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
              onClick={() => void understandingListActions.createEmptyUnderstanding()}
            >
              <Plus size={14} />
            </Button>
          </div>
        </header>
        {searchOpen && (
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="查找已有理解"
          />
        )}
      </div>

      {understandings.length === 0 ? (
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
        <div ref={listViewportRef} className="min-h-0 flex-1 overflow-y-auto pl-1 pb-3">
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const understanding = understandings[virtualRow.index];
              if (!understanding) return null;

              return (
                <div
                  key={understanding.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <UnderstandingRow
                    understanding={understanding}
                    selected={understanding.id === selectedUnderstandingId}
                    onChat={onChat}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
