import { FileText, Plus } from "lucide-react";
import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import { selectedCategoryIdAtom, selectedThoughtIdAtom } from "../state";
import { useThoughtListContext } from "./context";
import { ThoughtCard } from "./ThoughtCard";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@renderer/components/ui/empty";
import { ScrollArea } from "@renderer/components/ui/scroll-area";

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
  const hasSearchQuery = thoughtList.searchQuery.trim().length > 0;

  useEffect(() => {
    if (thoughtList.loading) return;
    const selectedIsVisible = thoughtList.displayedThoughts.some(
      (thought) => thought.id === selectedThoughtId,
    );
    if (selectedIsVisible) return;
    setSelectedThoughtId(thoughtList.displayedThoughts[0]?.id ?? null);
  }, [thoughtList.loading, thoughtList.displayedThoughts, selectedThoughtId, setSelectedThoughtId]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col border-r bg-card">
      <div className="space-y-3 px-3 py-3">
        <div className="flex h-8 items-center justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-medium">{categoryLabel}</div>
          <Button
            type="button"
            size="sm"
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
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3 pt-0">
          {thoughtList.displayedThoughts.map((thought) => (
            <ThoughtCard
              key={thought.id}
              thought={thought}
              selected={thought.id === selectedThoughtId}
            />
          ))}
          {thoughtList.displayedThoughts.length === 0 && (
            <Empty className="min-h-80 border-0 bg-muted/30 p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>{hasSearchQuery ? "没有匹配的理解" : "这里还没有理解"}</EmptyTitle>
                <EmptyDescription>
                  {hasSearchQuery
                    ? "可以直接写下新的个人理解。"
                    : "写下第一条理解后，它会立即出现在索引中。"}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
