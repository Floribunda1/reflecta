import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { FileText } from "lucide-react";
import { CategoryTree } from "./category";
import { ThoughtDetail } from "./thought-detail";
import { ThoughtList } from "./thought-list";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { selectedCategoryIdAtom, selectedThoughtIdAtom } from "./state";
import { searchEventBus, type SearchSelectPayload } from "@renderer/utils/searchEventBus";
import { ipcClient } from "@renderer/utils/ipc";

function CapturePageInner() {
  const selectedThoughtId = useAtomValue(selectedThoughtIdAtom);
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const setSelectedCategoryId = useSetAtom(selectedCategoryIdAtom);

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
      <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(280px,360px)_minmax(0,1fr)] overflow-hidden border-l bg-card/95 backdrop-blur-sm">
        <ThoughtList />
        <main className="min-h-0 min-w-0 overflow-hidden bg-transparent">
          {selectedThoughtId ? (
            <ThoughtDetail
              thoughtId={selectedThoughtId}
              onDeleted={() => setSelectedThoughtId(null)}
            />
          ) : (
            <Empty className="h-full">
              <EmptyContent>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyDescription>选择一条内容开始查看</EmptyDescription>
              </EmptyContent>
            </Empty>
          )}
        </main>
      </div>
    </div>
  );
}

export function CapturePage() {
  return <CapturePageInner />;
}
