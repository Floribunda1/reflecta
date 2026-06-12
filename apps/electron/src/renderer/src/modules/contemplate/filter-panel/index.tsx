import { Checkbox } from "@renderer/components/ui/checkbox";
import { Badge } from "@renderer/components/ui/badge";
import { Dropdown } from "@renderer/components/ui/dropdown";
import { useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Filter, Lightbulb, Plus, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useContemplatePageContext } from "../context";
import { CategoryTreeSelect } from "../../shared/biz-components/CategoryTreeSelect";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtType } from "@shared/thought";
import { cloneDeep } from "lodash-es";

export function FilterPanel() {
  const ctx = useContemplatePageContext();
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();

  const createThought = async (type: ThoughtType) => {
    const dto = await ipcClient.thought.createThought({
      type,
      body: "",
      categoryIds:
        ctx.selectedCategoryIds.length > 0 ? cloneDeep(ctx.selectedCategoryIds) : undefined,
    });
    await queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false });
    ctx.setSelectedThoughtId(dto.id);
  };

  return (
    <div className="absolute left-6 top-4 z-20">
      <div className="flex min-h-11 max-w-[min(760px,calc(100vw-5rem))] items-center gap-2 rounded-xl border border-border bg-background px-2 py-2 shadow-[0_8px_24px_rgb(15_23_42_/_0.08)] backdrop-blur">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={open ? "收起筛选" : "展开筛选"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={16} /> : <Filter size={16} />}
        </Button>

        <Dropdown>
          <Dropdown.Trigger
            aria-label="新建 Thought"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90"
          >
            <Plus size={16} />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom start">
            <Dropdown.Menu aria-label="新建 Thought 类型">
              <Dropdown.Item id="idea" onAction={() => void createThought("idea")}>
                <span className="flex items-center gap-2">
                  <Lightbulb size={14} className="text-amber-500" /> Idea
                </span>
              </Dropdown.Item>
              <Dropdown.Item id="insight" onAction={() => void createThought("insight")}>
                <span className="flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-500" /> Insight
                </span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        {open && (
          <div className="flex min-w-0 items-center gap-2 border-l border-border pl-2">
            <div className="w-[min(420px,calc(100vw-21rem))] min-w-64">
              <CategoryTreeSelect
                variant="inline"
                modelValue={ctx.selectedCategoryIds}
                onUpdateModelValue={ctx.setSelectedCategoryIds}
                placeholder="全部 Category"
              />
            </div>
            <Checkbox checked={ctx.showAllDescendants} onCheckedChange={ctx.setShowAllDescendants}>
              包含子类
            </Checkbox>
          </div>
        )}
      </div>

      {!open && ctx.selectedCategoryIds.length > 0 && (
        <Badge className="mt-2 backdrop-blur" variant="secondary">
          {ctx.selectedCategoryIds.length} 个 Category
        </Badge>
      )}
    </div>
  );
}
