import { FileText } from "lucide-react";
import { DomainTree } from "./domain";
import { UnderstandingDetail } from "./understanding-detail";
import { UnderstandingList } from "./understanding-list";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { useCaptureStore } from "./store";

function CapturePageInner() {
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );
  const setSearchOpen = useCaptureStore((state) => state.setSearchOpen);

  const handleWikiLinkClick = (understandingId: string) => {
    selectDomain("all");
    setSearchOpen(false);
    selectUnderstanding(understandingId);
  };

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[248px_minmax(0,1fr)] overflow-hidden bg-background/45 backdrop-blur-2xl">
      <DomainTree />
      <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(280px,360px)_minmax(0,1fr)] overflow-hidden border-l bg-card/95 backdrop-blur-sm">
        <UnderstandingList />
        <main className="min-h-0 min-w-0 overflow-hidden bg-transparent">
          {selectedUnderstandingId ? (
            <UnderstandingDetail
              understandingId={selectedUnderstandingId}
              onWikiLinkClick={handleWikiLinkClick}
              onDeleted={() => resetAfterUnderstandingDeleted(selectedUnderstandingId)}
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
