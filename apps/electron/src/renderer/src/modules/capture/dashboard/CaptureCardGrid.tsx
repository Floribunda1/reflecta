import { FileText } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { UnderstandingCard } from "@reflecta/ui/capture";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@reflecta/ui/components/empty";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import type { CaptureAgentScope } from "../store";
import { captureQueryKeys, getEntityDisplay, useCaptureDomains } from "../queries";
import {
  type ChatEntityPresentation,
  type ChatEntityReference,
  collectChatEntityReferences,
} from "@reflecta/ui/chat";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getUnderstandingTitle } from "../understanding-title";

function useCardEntityPresentations(understandings: readonly UnderstandingSummaryDTO[]) {
  // 收集网格内所有理解 body 的实体引用，统一查询后供行内摘要显示标题。
  const entityReferences = useMemo(
    () =>
      understandings.flatMap((understanding) =>
        collectChatEntityReferences(understanding.body ?? ""),
      ),
    [understandings],
  );
  const entityQueries = useQueries({
    queries: entityReferences.map((reference) => ({
      queryKey: captureQueryKeys.entityDisplay(reference),
      queryFn: () => getEntityDisplay(reference),
    })),
  });
  return useMemo(() => {
    const map = new Map<string, ChatEntityPresentation>();
    entityReferences.forEach((reference, index) => {
      const query = entityQueries[index];
      if (query?.data) {
        map.set(`${reference.type}:${reference.id}`, {
          state: "ready",
          label: query.data.title || reference.id,
          canOpen: reference.type !== "domain",
        });
      }
    });
    return map;
  }, [entityReferences, entityQueries]);
}

export function CaptureCardGrid({
  understandings,
  selectedUnderstandingId,
  onSelect,
  onChat,
  onDelete,
  searchActive = false,
}: {
  understandings: readonly UnderstandingSummaryDTO[];
  selectedUnderstandingId: string | null;
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
  const entityPresentations = useCardEntityPresentations(understandings);
  const resolveWikiLink = useMemo(
    () => (reference: ChatEntityReference) =>
      entityPresentations.get(`${reference.type}:${reference.id}`),
    [entityPresentations],
  );

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
          {understandings.map((understanding) => (
            <UnderstandingCard
              key={understanding.id}
              understanding={{
                id: understanding.id,
                title: getUnderstandingTitle(understanding),
                body: understanding.body,
                updatedLabel: formatDistanceToNow(understanding.updatedAt, {
                  addSuffix: true,
                  locale: zhCN,
                }),
                contextCount: understanding.contextCount,
                mentionCount: understanding.mentionCount,
                domainNames: understanding.domainIds
                  .map((domainId) => domainNameById.get(domainId))
                  .filter((name): name is string => Boolean(name)),
              }}
              selected={understanding.id === selectedUnderstandingId}
              canChat={Boolean(onChat)}
              resolveWikiLink={resolveWikiLink}
              onSelect={onSelect}
              onAction={(action) => {
                if (action.type === "chat") {
                  onSelect(understanding.id);
                  onChat?.({
                    type: "understanding",
                    id: understanding.id,
                    title: action.understanding.title,
                  });
                } else if (action.type === "delete") {
                  onDelete?.(understanding.id);
                }
              }}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
