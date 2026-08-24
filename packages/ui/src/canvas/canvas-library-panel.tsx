import { BookOpen, FileText, LayoutGrid, Search, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { ScrollArea } from "../components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import { Switch } from "../components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { DomainTreeSelect } from "../capture/domain-tree-select";
import type { DomainTreeNodeView } from "../capture/domain-tree";

export type CanvasLibraryItemView = {
  id: string;
  title: string;
};

export type CanvasLibrarySortBy = "updatedAt" | "createdAt";

export type CanvasLibraryTab = "understandings" | "canvases";

export type CanvasLibraryPanelProps = {
  items: readonly CanvasLibraryItemView[];
  domainTree: readonly DomainTreeNodeView[];
  canvases: readonly CanvasLibraryItemView[];
  tab: CanvasLibraryTab;
  loading?: boolean;
  domainsLoading?: boolean;
  canvasesLoading?: boolean;
  searchQuery: string;
  selectedDomainId: string;
  includeDescendants: boolean;
  sortBy: CanvasLibrarySortBy;
  onTabChange: (tab: CanvasLibraryTab) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectedDomainIdChange: (domainId: string) => void;
  onIncludeDescendantsChange: (include: boolean) => void;
  onSortByChange: (sortBy: CanvasLibrarySortBy) => void;
  onClose: () => void;
  onOpenCanvasRefPicker: () => void;
  onStartDragUnderstanding: (id: string, event: React.MouseEvent | React.PointerEvent) => void;
  onPickUnderstanding: (id: string) => void;
  onStartDragCanvas: (id: string, event: React.MouseEvent | React.PointerEvent) => void;
  onPickCanvas: (id: string) => void;
};

function LibraryRow({
  id,
  title,
  icon,
  testId,
  itemAttrs,
  onStartDrag,
  onPick,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  testId: string;
  itemAttrs: Record<string, string>;
  onStartDrag: (id: string, event: React.MouseEvent | React.PointerEvent) => void;
  onPick: (id: string) => void;
}) {
  return (
    <button
      key={id}
      type="button"
      data-testid={testId}
      {...itemAttrs}
      title={title}
      aria-label={`添加「${title}」到画布`}
      className="flex min-h-9 cursor-grab items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent active:cursor-grabbing"
      onMouseDown={(event) => onStartDrag(id, event)}
      onClick={() => onPick(id)}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </button>
  );
}

/**
 * 库面板：领域过滤（复用 DomainTreeSelect）/ 搜索 / 排序 / 列表展示 / 拖入画布创建卡。
 * 数据与过滤由上层持有；本组件只消费 display-ready 列表。
 */
export function CanvasLibraryPanel({
  items,
  domainTree,
  canvases,
  tab,
  loading = false,
  domainsLoading = false,
  canvasesLoading = false,
  searchQuery,
  selectedDomainId,
  includeDescendants,
  sortBy,
  onTabChange,
  onSearchQueryChange,
  onSelectedDomainIdChange,
  onIncludeDescendantsChange,
  onSortByChange,
  onClose,
  onOpenCanvasRefPicker,
  onStartDragUnderstanding,
  onPickUnderstanding,
  onStartDragCanvas,
  onPickCanvas,
}: CanvasLibraryPanelProps) {
  return (
    <aside
      data-testid="canvas-library-panel"
      className="flex h-full w-full min-w-0 shrink-0 flex-col border-l bg-background"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as CanvasLibraryTab)}
        className="flex h-full min-h-0 flex-col"
      >
        <header className="flex h-12 shrink-0 items-center gap-1.5 border-b px-3">
          <TabsList className="h-8">
            <TabsTrigger value="understandings">理解</TabsTrigger>
            <TabsTrigger value="canvases">画布</TabsTrigger>
          </TabsList>
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

        <TabsContent value="understandings" className="flex min-h-0 flex-1 flex-col">
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
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <DomainTreeSelect
                  mode="single"
                  value={selectedDomainId === "all" ? null : selectedDomainId}
                  onValueChange={(domainId) => onSelectedDomainIdChange(domainId ?? "all")}
                  nodes={domainTree}
                  status={domainsLoading ? "loading" : "ready"}
                  placeholder="全部领域"
                />
              </div>
              <Select
                value={sortBy}
                onValueChange={(value) => onSortByChange(value as CanvasLibrarySortBy)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="排序"
                  data-testid="canvas-library-sort"
                  className="h-8 w-28 shrink-0 justify-between px-2 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="updatedAt">最近更新</SelectItem>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex h-6 shrink-0 items-center justify-between gap-2 text-sm">
              <span>包含子领域</span>
              <Switch
                size="sm"
                checked={includeDescendants}
                onCheckedChange={onIncludeDescendantsChange}
                aria-label="包含子领域"
                data-testid="canvas-library-include-descendants"
              />
            </label>
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
                  <LibraryRow
                    key={understanding.id}
                    id={understanding.id}
                    title={understanding.title}
                    icon={<FileText size={13} />}
                    testId="canvas-library-item"
                    itemAttrs={{
                      "data-understanding-id": understanding.id,
                      "data-understanding-title": understanding.title,
                    }}
                    onStartDrag={onStartDragUnderstanding}
                    onPick={onPickUnderstanding}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <footer className="flex shrink-0 items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
            <span aria-hidden="true">↕</span>
            <span>拖拽理解到画布创建理解卡</span>
          </footer>
        </TabsContent>

        <TabsContent value="canvases" className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            {canvasesLoading ? (
              <div className="p-4 text-sm text-muted-foreground">加载中…</div>
            ) : canvases.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">还没有画布，先去画布列表新建</div>
            ) : (
              <div className="flex flex-col gap-1 p-2" data-testid="canvas-library-canvas-list">
                {canvases.map((canvas) => (
                  <LibraryRow
                    key={canvas.id}
                    id={canvas.id}
                    title={canvas.title}
                    icon={<LayoutGrid size={13} />}
                    testId="canvas-library-canvas-item"
                    itemAttrs={{
                      "data-canvas-id": canvas.id,
                      "data-canvas-title": canvas.title,
                    }}
                    onStartDrag={onStartDragCanvas}
                    onPick={onPickCanvas}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <footer className="shrink-0 border-t p-2 text-xs text-muted-foreground">
            拖拽画布到画布创建引用卡
          </footer>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
