import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { FileText } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@renderer/components/ui/empty";
import { CategoryTree } from "./category";
import { CategoryProvider } from "./category/context";
import { ThoughtDetail } from "./thought-detail";
import { ThoughtList } from "./thought-list";
import { useThoughtListContext } from "./thought-list/context";
import { ThoughtListProvider } from "./thought-list/context";
import { selectedCategoryIdAtom, selectedThoughtIdAtom } from "./state";
import { searchEventBus, type SearchSelectPayload } from "@renderer/utils/searchEventBus";
import { ipcClient } from "@renderer/utils/ipc";

function CapturePageInner() {
  const selectedThoughtId = useAtomValue(selectedThoughtIdAtom);
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const setSelectedCategoryId = useSetAtom(selectedCategoryIdAtom);
  const thoughtList = useThoughtListContext();

  useEffect(() => {
    const handleThoughtSelected = async ({ thoughtId, categoryIds }: SearchSelectPayload) => {
      setSelectedThoughtId(thoughtId);
      let cats = categoryIds;
      if (cats === undefined) {
        const thought = await ipcClient.thought.getThoughtById(thoughtId);
        cats = thought?.categoryIds ?? [];
      }
      setSelectedCategoryId(cats.length > 0 ? cats[0] : "all");
    };

    searchEventBus.on("thoughtSelected", handleThoughtSelected);
    return () => {
      searchEventBus.off("thoughtSelected", handleThoughtSelected);
    };
  }, [setSelectedThoughtId, setSelectedCategoryId]);

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[248px_minmax(0,1fr)] overflow-hidden bg-background/45 backdrop-blur-2xl">
      <CategoryTree />
      <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(280px,360px)_minmax(0,1fr)] overflow-hidden rounded-xl border bg-card/95 shadow-sm backdrop-blur-sm">
        <ThoughtList />
        <main className="min-h-0 min-w-0 overflow-hidden bg-background/95">
          {selectedThoughtId ? (
            <ThoughtDetail
              thoughtId={selectedThoughtId}
              onDeleted={() => setSelectedThoughtId(null)}
            />
          ) : (
            <Empty className="h-full rounded-none border-0 bg-muted/30 px-6 py-5">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>选择或写下一条理解</EmptyTitle>
                <EmptyDescription>新建后会立即创建一条空理解，并在这里直接编辑。</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" onClick={() => void thoughtList.createEmptyUnderstanding()}>
                  新建理解
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </main>
      </div>
    </div>
  );
}

export function CapturePage() {
  return (
    <CategoryProvider>
      <ThoughtListProvider>
        <CapturePageInner />
      </ThoughtListProvider>
    </CategoryProvider>
  );
}
