import { useDeferredValue, useMemo, useState } from "react";
import { BookOpen, FileText, Search, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reflecta/ui/components/tooltip";
import { Button } from "@reflecta/ui/components/button";
import { Input } from "@reflecta/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@reflecta/ui/components/native-select";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import {
  useCaptureDomains,
  useCaptureUnderstandingList,
  type UnderstandingListFilterKey,
} from "../../capture/queries";
import {
  sortUnderstandingSummaries,
  type UnderstandingListSortBy,
} from "../../capture/dashboard/sort";
import type { DomainTreeNode } from "@shared/domain";

/** 扁平化领域树为「全部领域 + 各领域」选项（缩进体现层级）。 */
function flattenDomains(
  nodes: readonly DomainTreeNode[],
  depth = 0,
): Array<{ id: string; name: string; depth: number }> {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenDomains(node.children, depth + 1),
  ]);
}

/**
 * 库面板（M5）：领域过滤 / 搜索 / 排序 / 列表展示 / 拖入画布创建理解卡；关闭恢复全宽（M6-5）。
 */
export function CanvasLibraryPanel({
  onClose,
  onOpenCanvasRefPicker,
  onStartDragUnderstanding,
  onPickUnderstanding,
}: {
  onClose: () => void;
  onOpenCanvasRefPicker: () => void;
  onStartDragUnderstanding: (id: string, e: React.MouseEvent | React.PointerEvent) => void;
  onPickUnderstanding: (id: string) => void;
}) {
  const { domains } = useCaptureDomains();
  const [selectedDomainId, setSelectedDomainId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<UnderstandingListSortBy>("updatedAt");

  // 防每键一次 IPC 查询：输入即时回显，查询用 deferred 值
  const deferredSearch = useDeferredValue(searchQuery);
  const filterKey: UnderstandingListFilterKey = {
    selectedDomainId,
    includeDescendants: true,
    searchQuery: deferredSearch,
  };
  const { data: understandings, isLoading } = useCaptureUnderstandingList(filterKey);
  const sorted = useMemo(
    () => sortUnderstandingSummaries(understandings ?? [], sortBy),
    [understandings, sortBy],
  );
  const domainOptions = useMemo(() => flattenDomains(domains), [domains]);

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
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="查找理解"
            aria-label="查找理解"
            data-testid="canvas-library-search"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect
            value={selectedDomainId}
            onChange={(event) => setSelectedDomainId(event.target.value)}
            aria-label="领域过滤"
            data-testid="canvas-library-domain-filter"
            className="min-w-0 flex-1"
            size="sm"
          >
            <NativeSelectOption value="all">全部领域</NativeSelectOption>
            {domainOptions.map((domain) => (
              <NativeSelectOption key={domain.id} value={domain.id}>
                {"\u00A0".repeat(domain.depth)} {domain.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as UnderstandingListSortBy)}
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
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">加载中…</div>
        ) : sorted.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {searchQuery.trim() ? "没有匹配的理解" : "还没有理解，先去 Capture 记录"}
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2" data-testid="canvas-library-list">
            {sorted.map((understanding) => (
              <button
                key={understanding.id}
                type="button"
                data-testid="canvas-library-item"
                data-understanding-id={understanding.id}
                data-understanding-title={understanding.title ?? "未命名理解"}
                className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                title="点击或拖入画布创建理解卡"
                onMouseDown={(event) => {
                  onStartDragUnderstanding(understanding.id, event);
                }}
                onClick={() => onPickUnderstanding(understanding.id)}
              >
                <FileText size={13} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {understanding.title ?? "未命名理解"}
                </span>
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
