import { Badge } from "@renderer/components/ui/badge";
import { useState } from "react";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { Filter, GitBranch, ListFilter, Plus, RotateCcw, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { type GraphStatusFilter, useContemplatePageContext } from "../context";
import { CategoryTreeSelect } from "../../shared/biz-components/CategoryTreeSelect";
import { ipcClient } from "@renderer/utils/ipc";
import { cn } from "@renderer/lib/utils";

const STATUS_FILTER_OPTIONS: Array<{ value: GraphStatusFilter; label: string }> = [
  { value: "all", label: "全部 Context" },
  { value: "with-context", label: "有 Context" },
  { value: "without-context", label: "无 Context" },
];

export function FilterPanel() {
  const ctx = useContemplatePageContext();
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();
  const selectedStatusOption =
    STATUS_FILTER_OPTIONS.find((option) => option.value === ctx.statusFilter) ??
    STATUS_FILTER_OPTIONS[0];
  const hasCategoryFilter = ctx.selectedCategoryIds.length > 0;
  const hasScopedToCurrentCategory = hasCategoryFilter && !ctx.showAllDescendants;
  const activeFilterCount =
    ctx.selectedCategoryIds.length +
    (hasScopedToCurrentCategory ? 1 : 0) +
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
    <div className="absolute left-4 top-12 z-20">
      <div className="inline-flex min-h-10 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-md border border-border bg-background px-2 py-2 shadow-sm">
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
          <div className="flex min-w-0 items-center gap-2 border-l border-border pl-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Context 筛选：${selectedStatusOption.label}`}
                    title={`Context 筛选：${selectedStatusOption.label}`}
                    className={cn(ctx.statusFilter !== "all" && "bg-muted text-foreground")}
                  >
                    <ListFilter size={16} />
                  </Button>
                }
              />
              <DropdownMenuContent side="bottom" align="start" className="w-36">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Context 状态</DropdownMenuLabel>
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
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 w-[28rem] max-w-[calc(100vw-20rem)]">
                <CategoryTreeSelect
                  modelValue={ctx.selectedCategoryIds}
                  onUpdateModelValue={ctx.setSelectedCategoryIds}
                  placeholder="全部 Category"
                />
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={ctx.showAllDescendants ? "已包含子类" : "仅当前类"}
                aria-pressed={ctx.showAllDescendants}
                title={ctx.showAllDescendants ? "包含子类" : "仅当前类"}
                className={cn(!ctx.showAllDescendants && "bg-muted text-foreground")}
                onClick={() => ctx.setShowAllDescendants(!ctx.showAllDescendants)}
              >
                <GitBranch size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {!open && activeFilterCount > 0 && (
        <Badge className="mt-2" variant="secondary">
          {activeFilterCount} 个筛选
        </Badge>
      )}
    </div>
  );
}
