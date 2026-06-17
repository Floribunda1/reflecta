import { FileText } from "lucide-react";
import { CategoryTree } from "./category";
import { ThoughtDetail } from "./thought-detail";
import { ThoughtList } from "./thought-list";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { useCaptureStore } from "./store";

function CapturePageInner() {
  const selectedThoughtId = useCaptureStore((state) => state.selectedThoughtId);
  const selectCategory = useCaptureStore((state) => state.selectCategory);
  const selectThought = useCaptureStore((state) => state.selectThought);
  const resetAfterThoughtDeleted = useCaptureStore((state) => state.resetAfterThoughtDeleted);
  const setSearchOpen = useCaptureStore((state) => state.setSearchOpen);

  const handleWikiLinkClick = (thoughtId: string) => {
    selectCategory("all");
    setSearchOpen(false);
    selectThought(thoughtId);
  };

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[248px_minmax(0,1fr)] overflow-hidden bg-background/45 backdrop-blur-2xl">
      <CategoryTree />
      <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(280px,360px)_minmax(0,1fr)] overflow-hidden border-l bg-card/95 backdrop-blur-sm">
        <ThoughtList />
        <main className="min-h-0 min-w-0 overflow-hidden bg-transparent">
          {selectedThoughtId ? (
            <ThoughtDetail
              thoughtId={selectedThoughtId}
              onWikiLinkClick={handleWikiLinkClick}
              onDeleted={() => resetAfterThoughtDeleted(selectedThoughtId)}
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
