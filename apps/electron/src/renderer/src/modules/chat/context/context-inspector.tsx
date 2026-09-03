import { Effect } from "effect";
import { useQuery } from "@tanstack/react-query";
import { effectQuery } from "@renderer/lib/effect-query";
import { rpc } from "@renderer/lib/effect-rpc";
import {
  ContextPreviewDrawerContent,
  DeletedDetailPlaceholder,
  UnderstandingDetail,
} from "@renderer/modules/capture/understanding-detail";
import type { ContextDTO } from "@shared/context";
import type { InspectableContextRef, InspectorPanelRef } from "./context-reference";

export function ContextInspector({
  refToInspect,
  onClose,
  onInspect,
  focusMode = false,
  onFocusModeChange,
}: {
  refToInspect: InspectorPanelRef;
  onClose: () => void;
  onInspect: (ref: InspectableContextRef) => void;
  focusMode?: boolean;
  onFocusModeChange?: (focused: boolean) => void;
}) {
  const contextQuery = useQuery(
    effectQuery.queryOptions({
      queryKey: ["agent.inspector.context", refToInspect.id] as const,
      queryFn: () =>
        rpc.contextGetById(refToInspect.id).pipe(Effect.map((dto) => dto as ContextDTO | null)),
      enabled: refToInspect.type === "context",
    }),
  );

  return (
    <aside
      data-testid="agent-context-inspector"
      className="flex min-h-0 min-w-0 flex-col h-full bg-transparent"
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        {refToInspect.type === "understanding" ? (
          <UnderstandingDetail
            understandingId={refToInspect.id}
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
          <DeletedDetailPlaceholder entityLabel="上下文" onClose={onClose} />
        ) : null}
      </div>
    </aside>
  );
}
