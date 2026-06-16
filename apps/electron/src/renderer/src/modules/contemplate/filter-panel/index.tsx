import { Checkbox } from "@renderer/components/ui/checkbox";
import { Badge } from "@renderer/components/ui/badge";
import { useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { Filter, ListFilter, Plus, RotateCcw, Search, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { type GraphStatusFilter, useContemplatePageContext } from "../context";
import { CategoryTreeSelect } from "../../shared/biz-components/CategoryTreeSelect";
import { ipcClient } from "@renderer/utils/ipc";
import { cn } from "@renderer/lib/utils";

const STATUS_FILTER_OPTIONS: Array<{ value: GraphStatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "with-context", label: "有 Context" },
  { value: "without-context", label: "无 Context" },
  { value: "connected", label: "已连接" },
  { value: "isolated", label: "未连接" },
];

export function FilterPanel() {
  const ctx = useContemplatePageContext();
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();
  const selectedStatusOption =
    STATUS_FILTER_OPTIONS.find((option) => option.value === ctx.statusFilter) ??
    STATUS_FILTER_OPTIONS[0];
  const activeFilterCount =
    ctx.selectedCategoryIds.length +
    (ctx.showAllDescendants ? 1 : 0) +
    (ctx.searchQuery.trim() ? 1 : 0) +
    (ctx.statusFilter !== "all" ? 1 : 0);

  const createThought = async () => {
    const dto = await ipcClient.thought.createThought({
      body: "",
      categoryIds: ctx.selectedCategoryIds.length > 0 ? [...ctx.selectedCategoryIds] : undefined,
    });
    await queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false });
    ctx.setSelectedThoughtId(dto.id);
  };

  return (
    <div className="absolute left-6 top-4 z-20">
      <div className="flex min-h-11 max-w-[min(1040px,calc(100vw-3rem))] flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2 py-2 shadow-[0_8px_24px_rgb(15_23_42_/_0.08)] backdrop-blur">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={open ? "收起筛选" : "展开筛选"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={16} /> : <Filter size={16} />}
        </Button>

        <Button
          type="button"
          size="icon-sm"
          aria-label="新建 Understanding"
          onClick={() => void createThought()}
        >
          <Plus size={16} />
        </Button>

        {open && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 border-l border-border pl-2">
            <div className="relative min-w-44 max-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={ctx.searchQuery}
                onChange={(event) => ctx.setSearchQuery(event.target.value)}
                className="h-8 pl-8 text-sm"
                placeholder="搜索 Thought"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="筛选节点状态"
                    className={cn(ctx.statusFilter !== "all" && "bg-muted text-foreground")}
                  >
                    <ListFilter size={14} />
                    {selectedStatusOption.label}
                  </Button>
                }
              />
              <DropdownMenuContent side="bottom" align="start" className="w-36">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>节点状态</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={ctx.statusFilter}
                    onValueChange={(value) => ctx.setStatusFilter(value as GraphStatusFilter)}
                  >
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="重置筛选"
              disabled={activeFilterCount === 0}
              onClick={ctx.resetFilters}
            >
              <RotateCcw size={14} />
            </Button>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 border-t border-border pt-2">
              <div className="min-w-64 max-w-[460px] flex-1">
                <CategoryTreeSelect
                  variant="inline"
                  modelValue={ctx.selectedCategoryIds}
                  onUpdateModelValue={ctx.setSelectedCategoryIds}
                  placeholder="全部 Category"
                />
              </div>
              <Checkbox
                checked={ctx.showAllDescendants}
                onCheckedChange={ctx.setShowAllDescendants}
              >
                包含子类
              </Checkbox>
            </div>
          </div>
        )}
      </div>

      {!open && activeFilterCount > 0 && (
        <Badge className="mt-2 backdrop-blur" variant="secondary">
          {activeFilterCount} 个筛选
        </Badge>
      )}
    </div>
  );
}
