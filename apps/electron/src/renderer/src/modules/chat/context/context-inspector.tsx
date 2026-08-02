import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
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
      <div
        className={`h-14 shrink-0 items-center justify-between gap-3 border-b px-4 ${focusMode ? "hidden" : "flex"}`}
      >
        <div className="text-sm font-medium">详情</div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="关闭详情"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {refToInspect.type === "understanding" ? (
          <UnderstandingDetail
            understandingId={refToInspect.id}
            focusMode={focusMode}
            onFocusModeChange={onFocusModeChange}
            onWikiLinkClick={(understandingId: string) =>
              onInspect({ type: "understanding", id: understandingId })
            }
          />
        ) : null}
        {refToInspect.type === "context" && contextQuery.data ? (
          <div className="p-4">
            <ContextPreviewDrawerContent context={contextQuery.data} />
          </div>
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
