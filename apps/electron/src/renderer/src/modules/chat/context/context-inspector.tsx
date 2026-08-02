import { useQuery } from "@tanstack/react-query";
import {
  ContextPreviewDrawerContent,
  UnderstandingDetail,
} from "@renderer/modules/capture/understanding-detail";
import { ipcClient } from "@renderer/utils/ipc";
import type { InspectableContextRef } from "./context-reference";

export function ContextInspector({
  refToInspect,
  onClose,
  onInspect,
  focusMode = false,
  onFocusModeChange,
}: {
  refToInspect: InspectableContextRef;
  onClose: () => void;
  onInspect: (ref: InspectableContextRef) => void;
  focusMode?: boolean;
  onFocusModeChange?: (focused: boolean) => void;
}) {
  const contextQuery = useQuery({
    queryKey: ["agent.inspector.context", refToInspect.id],
    queryFn: () => ipcClient.context.getContextById(refToInspect.id),
    enabled: refToInspect.type === "context",
  });

  return (
    <aside
      data-testid="agent-context-inspector"
      className={`flex min-h-0 min-w-0 flex-col ${focusMode ? "fixed inset-0 z-50 h-auto bg-background" : "h-full bg-transparent"}`}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        {refToInspect.type === "understanding" ? (
          <UnderstandingDetail
            understandingId={refToInspect.id}
            focusMode={focusMode}
            onFocusModeChange={onFocusModeChange}
            onClose={onClose}
            onWikiLinkClick={(understandingId: string) =>
              onInspect({ type: "understanding", id: understandingId })
            }
          />
        ) : null}
        {refToInspect.type === "context" && contextQuery.data ? (
          <ContextPreviewDrawerContent
            context={contextQuery.data}
            focusMode={focusMode}
            onFocusModeChange={onFocusModeChange}
            onClose={onClose}
          />
        ) : null}
        {refToInspect.type === "context" && contextQuery.isFetching ? (
          <div className="p-4 text-sm text-muted-foreground">加载中...</div>
        ) : null}
        {refToInspect.type === "context" && !contextQuery.isFetching && !contextQuery.data ? (
          <div className="p-4 text-sm text-muted-foreground">没有找到这条内容。</div>
        ) : null}
      </div>
    </aside>
  );
}
