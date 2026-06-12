import { FileText, Plus } from "lucide-react";
import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import { selectedCategoryIdAtom, selectedThoughtIdAtom } from "../state";
import { useThoughtListContext } from "./context";
import { ThoughtCard } from "./ThoughtCard";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";

export function ThoughtList() {
  const thoughtList = useThoughtListContext();
  const selectedCategoryId = useAtomValue(selectedCategoryIdAtom);
  const selectedThoughtId = useAtomValue(selectedThoughtIdAtom);
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const { categoryList } = useCategoryData();

  const categoryLabel =
    selectedCategoryId === "all"
      ? "全部领域"
      : (categoryList.find((c) => c.id === selectedCategoryId)?.name ?? "");

  useEffect(() => {
    if (thoughtList.loading) return;
    const selectedIsVisible = thoughtList.displayedThoughts.some(
      (thought) => thought.id === selectedThoughtId,
    );
    if (selectedIsVisible) return;
    setSelectedThoughtId(thoughtList.displayedThoughts[0]?.id ?? null);
  }, [
    thoughtList.loading,
    thoughtList.displayedThoughts,
    selectedThoughtId,
    setSelectedThoughtId,
  ]);

  return (
    <section className="flex h-full w-[340px] shrink-0 flex-col border-r border-border/60 bg-background">
      <div className="flex shrink-0 flex-col gap-2.5 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-muted-foreground">当前领域</div>
            <div className="truncate text-sm font-medium text-foreground">{categoryLabel}</div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void thoughtList.createEmptyUnderstanding()}
          >
            <Plus size={14} />
            新建
          </Button>
        </div>
        <Input
          value={thoughtList.searchQuery}
          onChange={(event) => thoughtList.setSearchQuery(event.target.value)}
          placeholder="查找已有理解"
          className="h-8 rounded-md border-border/45 bg-muted/30 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-border/70"
        />
      </div>

      <div className="capture-scroll min-h-0 flex-1 overflow-y-auto border-t border-border/50">
        <div className="flex w-full flex-col gap-1.5 px-3 py-2.5">
          <button
            type="button"
            className="w-full rounded-lg border border-border/35 bg-transparent px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:border-border/65 hover:bg-muted/35 hover:text-foreground"
            onClick={() => void thoughtList.createEmptyUnderstanding()}
          >
            写下个人理解
          </button>
          {thoughtList.displayedThoughts.map((thought) => (
            <ThoughtCard key={thought.id} thought={thought} />
          ))}
          {thoughtList.displayedThoughts.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-transparent px-4 py-12">
              <FileText size={24} className="text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">这里还没有理解</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
