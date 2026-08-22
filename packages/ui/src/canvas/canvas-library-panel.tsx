import { BookOpen, FileText, Search, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { NativeSelect, NativeSelectOption } from "../components/native-select";
import { ScrollArea } from "../components/scroll-area";

export type CanvasLibraryItemView = {
  id: string;
  title: string;
};

export type CanvasLibraryDomainOption = {
  id: string;
  name: string;
  depth: number;
};

export type CanvasLibrarySortBy = "updatedAt" | "createdAt";

export type CanvasLibraryPanelProps = {
  items: readonly CanvasLibraryItemView[];
  domains: readonly CanvasLibraryDomainOption[];
  loading?: boolean;
  searchQuery: string;
  selectedDomainId: string;
  sortBy: CanvasLibrarySortBy;
  onSearchQueryChange: (query: string) => void;
  onSelectedDomainIdChange: (domainId: string) => void;
  onSortByChange: (sortBy: CanvasLibrarySortBy) => void;
  onClose: () => void;
  onOpenCanvasRefPicker: () => void;
  onStartDragUnderstanding: (id: string, event: React.MouseEvent | React.PointerEvent) => void;
  onPickUnderstanding: (id: string) => void;
};

/**
 * 库面板：领域过滤 / 搜索 / 排序 / 列表展示 / 拖入画布创建理解卡。
 * 数据与过滤由上层持有；本组件只消费 display-ready 列表。
 */
export function CanvasLibraryPanel({
  items,
  domains,
  loading = false,
  searchQuery,
  selectedDomainId,
  sortBy,
  onSearchQueryChange,
  onSelectedDomainIdChange,
  onSortByChange,
  onClose,
  onOpenCanvasRefPicker,
  onStartDragUnderstanding,
  onPickUnderstanding,
}: CanvasLibraryPanelProps) {
  return (
    <aside
      data-testid="canvas-library-panel"
      className="flex h-full w-72 shrink-0 flex-col border-l bg-background"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-sm font-medium">理解库</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="引用画布"
                data-testid="canvas-open-canvasref-picker"
                onClick={onOpenCanvasRefPicker}
              />
            }
          >
            <BookOpen size={14} />
          </TooltipTrigger>
          <TooltipContent>引用画布</TooltipContent>
        </Tooltip>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="关闭理解库"
          data-testid="canvas-library-close"
          className="ml-auto"
          onClick={onClose}
        >
          <X size={15} />
        </Button>
      </header>

      <div className="flex shrink-0 flex-col gap-2 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="查找理解"
            aria-label="查找理解"
            data-testid="canvas-library-search"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect
            value={selectedDomainId}
            onChange={(event) => onSelectedDomainIdChange(event.target.value)}
            aria-label="领域过滤"
            data-testid="canvas-library-domain-filter"
            className="min-w-0 flex-1"
            size="sm"
          >
            <NativeSelectOption value="all">全部领域</NativeSelectOption>
            {domains.map((domain) => (
              <NativeSelectOption key={domain.id} value={domain.id}>
                {"\u00A0".repeat(domain.depth)} {domain.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value as CanvasLibrarySortBy)}
            aria-label="排序"
            data-testid="canvas-library-sort"
            size="sm"
          >
            <NativeSelectOption value="updatedAt">最近更新</NativeSelectOption>
            <NativeSelectOption value="createdAt">创建时间</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">加载中…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {searchQuery.trim() ? "没有匹配的理解" : "还没有理解，先去 Capture 记录"}
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2" data-testid="canvas-library-list">
            {items.map((understanding) => (
              <button
                key={understanding.id}
                type="button"
                data-testid="canvas-library-item"
                data-understanding-id={understanding.id}
                data-understanding-title={understanding.title}
                className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                title="点击或拖入画布创建理解卡"
                onMouseDown={(event) => {
                  onStartDragUnderstanding(understanding.id, event);
                }}
                onClick={() => onPickUnderstanding(understanding.id)}
              >
                <FileText size={13} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{understanding.title}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <footer className="shrink-0 border-t p-2 text-xs text-muted-foreground">
        拖拽理解到画布创建理解卡
      </footer>
    </aside>
  );
}
