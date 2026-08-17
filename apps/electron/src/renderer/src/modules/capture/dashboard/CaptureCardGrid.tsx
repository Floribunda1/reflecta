import { FileText } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import {
  UnderstandingCard,
  type UnderstandingCardAction,
  type UnderstandingCardView,
} from "@reflecta/ui/capture";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@reflecta/ui/components/empty";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import type { CaptureAgentScope } from "../store";
import { useCaptureStore } from "../store";
import { captureQueryKeys, getEntityDisplay, useCaptureDomains } from "../queries";
import {
  collectChatEntityReferences,
  type ChatEntityReference,
  type ResolveChatEntity,
} from "@reflecta/ui/chat";
import { buildUnderstandingCardView } from "./card-view";
import {
  entityPresentationKey,
  mergeEntityPresentations,
  presentationsFromUnderstandings,
  remoteEntityReferences,
} from "./card-entity-presentations";

function useCardEntityPresentations(understandings: readonly UnderstandingSummaryDTO[]) {
  const localPresentations = useMemo(
    () => presentationsFromUnderstandings(understandings),
    [understandings],
  );
  const entityReferences = useMemo(
    () =>
      understandings.flatMap((understanding) =>
        collectChatEntityReferences(understanding.body ?? ""),
      ),
    [understandings],
  );
  const remoteReferences = useMemo(
    () => remoteEntityReferences(entityReferences, localPresentations),
    [entityReferences, localPresentations],
  );
  const entityQueries = useQueries({
    queries: remoteReferences.map((reference) => ({
      queryKey: captureQueryKeys.entityDisplay(reference),
      queryFn: () => getEntityDisplay(reference),
    })),
  });
  const remotePending = entityQueries.some((query) => query.isPending);
  const remoteTitleKey = entityQueries.map((query) => query.data?.title ?? "").join("\0");
  return useMemo(() => {
    if (remotePending || remoteReferences.length === 0) return localPresentations;
    return mergeEntityPresentations(
      localPresentations,
      remoteReferences,
      entityQueries.map((query) => query.data),
    );
  }, [entityQueries, localPresentations, remotePending, remoteReferences, remoteTitleKey]);
}

const CaptureUnderstandingCard = memo(function CaptureUnderstandingCard({
  understanding,
  canChat,
  resolveWikiLink,
  onSelect,
  onChat,
  onDelete,
}: {
  understanding: UnderstandingCardView;
  canChat: boolean;
  resolveWikiLink: ResolveChatEntity;
  onSelect: (understandingId: string) => void;
  onChat?: (scope: CaptureAgentScope) => void;
  onDelete?: (understandingId: string) => void;
}) {
  const selected = useCaptureStore((state) => state.selectedUnderstandingId === understanding.id);

  const handleAction = useCallback(
    (action: UnderstandingCardAction) => {
      if (action.type === "chat") {
        onSelect(understanding.id);
        onChat?.({
          type: "understanding",
          id: understanding.id,
          title: action.understanding.title,
        });
        return;
      }
      onDelete?.(understanding.id);
    },
    [onChat, onDelete, onSelect, understanding.id],
  );

  return (
    <UnderstandingCard
      understanding={understanding}
      selected={selected}
      canChat={canChat}
      resolveWikiLink={resolveWikiLink}
      onSelect={onSelect}
      onAction={handleAction}
    />
  );
});

export function CaptureCardGrid({
  understandings,
  onSelect,
  onChat,
  onDelete,
  searchActive = false,
}: {
  understandings: readonly UnderstandingSummaryDTO[];
  onSelect: (understandingId: string) => void;
  onChat?: (scope: CaptureAgentScope) => void;
  onDelete?: (understandingId: string) => void;
  searchActive?: boolean;
}) {
  const { domainList } = useCaptureDomains();
  const domainNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const domain of domainList) map.set(domain.id, domain.name);
    return map;
  }, [domainList]);
  const cardViews = useMemo(
    () =>
      understandings.map((understanding) =>
        buildUnderstandingCardView(understanding, domainNameById),
      ),
    [domainNameById, understandings],
  );
  const entityPresentations = useCardEntityPresentations(understandings);
  const resolveWikiLink = useMemo(
    () => (reference: ChatEntityReference) =>
      entityPresentations.get(entityPresentationKey(reference)),
    [entityPresentations],
  );
  const canChat = Boolean(onChat);

  if (understandings.length === 0) {
    return (
      <div className="min-h-0 flex-1">
        <Empty className="h-full">
          <EmptyContent>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyDescription>
              {searchActive ? "没有找到相关内容" : "暂时没有内容"}
            </EmptyDescription>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="min-h-0 min-w-0 flex-1">
      <ScrollArea className="h-full w-full [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/30 [&_[data-slot=scroll-area-thumb]]:hover:bg-muted-foreground/50">
        <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cardViews.map((understanding) => (
            <CaptureUnderstandingCard
              key={understanding.id}
              understanding={understanding}
              canChat={canChat}
              resolveWikiLink={resolveWikiLink}
              onSelect={onSelect}
              onChat={onChat}
              onDelete={onDelete}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
