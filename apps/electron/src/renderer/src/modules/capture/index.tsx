import { useEffect } from "react";
import { CategoryTree } from "./category";
import { CapturePageProvider, useCapturePageContext } from "./context";
import { CategoryProvider } from "./category/context";
import { ThoughtDetail } from "./thought-detail";
import { ThoughtList } from "./thought-list";
import { ThoughtListProvider } from "./thought-list/context";
import { searchEventBus, type SearchSelectPayload } from "@renderer/utils/searchEventBus";
import { ipcClient } from "@renderer/utils/ipc";

function CapturePageInner() {
  const capture = useCapturePageContext();

  useEffect(() => {
    const handleThoughtSelected = async ({ thoughtId, categoryIds }: SearchSelectPayload) => {
      capture.setSelectedThoughtId(thoughtId);
      let cats = categoryIds;
      if (cats === undefined) {
        const thought = await ipcClient.thought.getThoughtById(thoughtId);
        cats = thought?.categoryIds ?? [];
      }
      capture.setSelectedCategoryId(cats.length > 0 ? cats[0] : "all");
    };

    searchEventBus.on("thoughtSelected", handleThoughtSelected);
    return () => {
      searchEventBus.off("thoughtSelected", handleThoughtSelected);
    };
  }, [capture]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      <CategoryTree />
      <ThoughtList />
      <main className="min-w-0 flex-1 overflow-hidden">
        {capture.selectedThoughtId ? (
          <ThoughtDetail
            thoughtId={capture.selectedThoughtId}
            onDeleted={() => capture.setSelectedThoughtId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-background px-8">
            <div className="max-w-sm text-center">
              <div className="text-sm font-medium text-foreground">选择或写下一条理解</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                当前领域的理解会在左侧索引中出现。新建后会立即创建一条空理解，并在这里直接编辑。
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export function CapturePage() {
  return (
    <CapturePageProvider>
      <CategoryProvider>
        <ThoughtListProvider>
          <CapturePageInner />
        </ThoughtListProvider>
      </CategoryProvider>
    </CapturePageProvider>
  );
}
