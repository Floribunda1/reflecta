import { FileText } from "lucide-react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  UnderstandingCard,
  type UnderstandingCardAction,
  type UnderstandingCardView,
} from "@reflecta/ui/capture";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@reflecta/ui/components/empty";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import type { CaptureAgentScope } from "../store";
import { useAtomValue } from "@effect/atom-react";
import { selectedUnderstandingIdAtom } from "../store";
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
import {
  captureGridColumnCount,
  captureGridRowCount,
  captureGridRowSlice,
  captureGridVisibleSlice,
} from "./card-grid-layout";

const CARD_ROW_ESTIMATE_PX = 188;
const CARD_ROW_GAP_PX = 12;
const CARD_ROW_OVERSCAN = 3;
/** 行左 pl-4。右边滚动条占 10px（globals ::-webkit-scrollbar），pr 只留 6px，视觉上左右都是 16px。 */
const CARD_GRID_PADDING_LEFT_PX = 16;
const CARD_GRID_PADDING_RIGHT_PX = 6;

function useCaptureGridColumnCount(containerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [columns, setColumns] = useState(1);

  useLayoutEffect(() => {
    if (!enabled) return;
    const element = containerRef.current;
    if (!element) return;
    const update = (width: number) =>
      setColumns(
        captureGridColumnCount(
          Math.max(0, width - CARD_GRID_PADDING_LEFT_PX - CARD_GRID_PADDING_RIGHT_PX),
        ),
      );
    update(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, enabled]);

  return columns;
}

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
  // 稳定串作为 presentations 的重算依据：useQueries 返回数组每次渲染都是新引用，
  // 直接依赖它会让 memo 链（resolveWikiLink → 卡片）每渲染全量失效，重渲染+重解析 md。
  const remoteTitleKey = entityQueries.map((query) => query.data?.title ?? "").join("\0");
  const queryClient = useQueryClient();
  return useMemo(() => {
    if (remotePending || remoteReferences.length === 0) return localPresentations;
    const remoteResults = remoteReferences.map((reference) =>
      queryClient.getQueryData<{ title: string | null } | null>(
        captureQueryKeys.entityDisplay(reference),
      ),
    );
    return mergeEntityPresentations(localPresentations, remoteReferences, remoteResults);
  }, [localPresentations, queryClient, remotePending, remoteReferences, remoteTitleKey]);
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
  const selected = useAtomValue(selectedUnderstandingIdAtom) === understanding.id;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = useCaptureGridColumnCount(scrollRef, understandings.length > 0);
  const { domainList } = useCaptureDomains();
  const domainNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const domain of domainList) map.set(domain.id, domain.name);
    return map;
  }, [domainList]);

  const rowCount = captureGridRowCount(understandings.length, columns);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_ROW_ESTIMATE_PX,
    overscan: CARD_ROW_OVERSCAN,
    gap: CARD_ROW_GAP_PX,
    getItemKey: (index) => `${columns}:${index}`,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const visibleStartRow = virtualRows[0]?.index ?? 0;
  const visibleEndRow = virtualRows.at(-1)?.index ?? -1;
  const visibleUnderstandings = useMemo(
    () => captureGridVisibleSlice(understandings, visibleStartRow, visibleEndRow, columns),
    [columns, understandings, visibleEndRow, visibleStartRow],
  );
  const cardViews = useMemo(
    () =>
      visibleUnderstandings.map((understanding) =>
        buildUnderstandingCardView(understanding, domainNameById),
      ),
    [domainNameById, visibleUnderstandings],
  );
  const entityPresentations = useCardEntityPresentations(visibleUnderstandings);
  const resolveWikiLink = useMemo(
    () => (reference: ChatEntityReference) =>
      entityPresentations.get(entityPresentationKey(reference)),
    [entityPresentations],
  );
  const canChat = Boolean(onChat);
  const cardViewById = useMemo(() => {
    const map = new Map<string, UnderstandingCardView>();
    for (const view of cardViews) map.set(view.id, view);
    return map;
  }, [cardViews]);

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
      <div
        ref={scrollRef}
        data-testid="capture-card-grid"
        className="h-full min-h-0 overflow-y-auto"
      >
        <div className="relative w-full pb-4" style={{ height: rowVirtualizer.getTotalSize() }}>
          {virtualRows.map((virtualRow) => {
            const rowItems = captureGridRowSlice(understandings, virtualRow.index, columns);
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute top-0 left-0 grid w-full gap-3 pl-4 pr-1.5"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {rowItems.map((understanding) => {
                  const view = cardViewById.get(understanding.id);
                  if (!view) return null;
                  return (
                    <CaptureUnderstandingCard
                      key={understanding.id}
                      understanding={view}
                      canChat={canChat}
                      resolveWikiLink={resolveWikiLink}
                      onSelect={onSelect}
                      onChat={onChat}
                      onDelete={onDelete}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
