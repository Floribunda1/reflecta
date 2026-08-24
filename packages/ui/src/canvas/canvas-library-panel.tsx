import { ArrowUpDown, FileText, GitBranch, LayoutGrid, Search, X } from "lucide-react";
import { Button } from "../components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../components/input-group";
import { ScrollArea } from "../components/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { DomainTreeSelect } from "../capture/domain-tree-select";
import type { DomainTreeNodeView } from "../capture/domain-tree";

export type CanvasLibraryItemView = {
  id: string;
  title: string;
  meta?: string;
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
  onStartDragUnderstanding: (id: string, event: React.MouseEvent | React.PointerEvent) => void;
  onPickUnderstanding: (id: string) => void;
  onStartDragCanvas: (id: string, event: React.MouseEvent | React.PointerEvent) => void;
  onPickCanvas: (id: string) => void;
};

function LibraryRow({
  id,
  title,
  meta,
  icon,
  testId,
  itemAttrs,
  onStartDrag,
  onPick,
}: {
  id: string;
  title: string;
  meta?: string;
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
      className="flex min-h-9 cursor-grab items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent active:cursor-grabbing"
      onMouseDown={(event) => onStartDrag(id, event)}
      onClick={() => onPick(id)}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        {meta ? <span className="block truncate text-xs text-muted-foreground">{meta}</span> : null}
      </span>
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
  onStartDragUnderstanding,
  onPickUnderstanding,
  onStartDragCanvas,
  onPickCanvas,
}: CanvasLibraryPanelProps) {
  return (
    <aside
      data-testid="canvas-library-panel"
      className="flex h-full w-full min-w-0 shrink-0 flex-col bg-background"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as CanvasLibraryTab)}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border px-3">
          <TabsList className="h-8">
            <TabsTrigger value="understandings" aria-label="理解" title="理解">
              <FileText />
            </TabsTrigger>
            <TabsTrigger value="canvases" aria-label="画布" title="画布">
              <LayoutGrid />
            </TabsTrigger>
          </TabsList>
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

        {tab === "understandings" ? (
          <div className="flex shrink-0 flex-col gap-1.5 p-2">
            <div className="flex items-center gap-1.5">
              <InputGroup className="min-w-0 flex-1">
                <InputGroupAddon align="inline-start">
                  <Search className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  placeholder="查找理解"
                  aria-label="查找理解"
                  data-testid="canvas-library-search"
                />
              </InputGroup>
              <Button
                type="button"
                size="icon-sm"
                variant={includeDescendants ? "secondary" : "ghost"}
                aria-label={includeDescendants ? "已包含子领域" : "未包含子领域"}
                title={includeDescendants ? "已包含子领域" : "未包含子领域"}
                data-testid="canvas-library-include-descendants"
                onClick={() => onIncludeDescendantsChange(!includeDescendants)}
              >
                <GitBranch />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="排序理解"
                      title="排序理解"
                      data-testid="canvas-library-sort"
                    />
                  }
                >
                  <ArrowUpDown />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>排序</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={sortBy}
                      onValueChange={(value) => onSortByChange(value as CanvasLibrarySortBy)}
                    >
                      <DropdownMenuRadioItem value="updatedAt">按更新时间</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="createdAt">按创建时间</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="min-w-0">
              <DomainTreeSelect
                mode="single"
                value={selectedDomainId === "all" ? null : selectedDomainId}
                onValueChange={(domainId) => onSelectedDomainIdChange(domainId ?? "all")}
                nodes={domainTree}
                status={domainsLoading ? "loading" : "ready"}
                placeholder="全部领域"
                size="sm"
                variant="inline"
              />
            </div>
          </div>
        ) : (
          <div className="shrink-0 p-2">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <Search className="size-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="查找画布"
                aria-label="查找画布"
                data-testid="canvas-library-search"
              />
            </InputGroup>
          </div>
        )}

        <TabsContent value="understandings" className="flex min-h-0 flex-1 flex-col">
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
                    meta={understanding.meta}
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
        </TabsContent>

        <TabsContent value="canvases" className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            {canvasesLoading ? (
              <div className="p-4 text-sm text-muted-foreground">加载中…</div>
            ) : canvases.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {searchQuery.trim() ? "没有匹配的画布" : "还没有其他画布，先去画布列表新建"}
              </div>
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
        </TabsContent>
      </Tabs>
    </aside>
  );
}
