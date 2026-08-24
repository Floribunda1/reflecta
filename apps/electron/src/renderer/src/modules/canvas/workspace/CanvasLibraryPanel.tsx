import { useDeferredValue, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CanvasLibraryPanel as CanvasLibraryPanelView,
  type CanvasLibrarySortBy,
  type CanvasLibraryTab,
} from "@reflecta/ui/canvas";
import {
  useCaptureDomains,
  useCaptureUnderstandingList,
  type UnderstandingListFilterKey,
} from "../../capture/queries";
import { useCanvasList } from "../queries";
import { sortUnderstandingSummaries } from "../../capture/dashboard/sort";

/**
 * 库面板 Adapter（M5）：领域过滤 / 搜索 / 排序走 Capture query；展示由 UI 面板承担。
 */
export function CanvasLibraryPanel({
  canvasId,
  onClose,
  onStartDragUnderstanding,
  onStartDragCanvas,
  onPickUnderstanding,
  onPickCanvas,
}: {
  canvasId: string;
  onClose: () => void;
  onStartDragUnderstanding: (id: string, e: React.MouseEvent | React.PointerEvent) => void;
  onStartDragCanvas: (id: string, e: React.MouseEvent | React.PointerEvent) => void;
  onPickUnderstanding: (id: string) => void;
  onPickCanvas: (id: string) => void;
}) {
  const { domains, loading: domainsLoading } = useCaptureDomains();
  const { data: canvases, isLoading: canvasesLoading } = useCanvasList();
  const [tab, setTab] = useState<CanvasLibraryTab>("understandings");
  const [selectedDomainId, setSelectedDomainId] = useState("all");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<CanvasLibrarySortBy>("updatedAt");

  const deferredSearch = useDeferredValue(searchQuery);
  const filterKey: UnderstandingListFilterKey = {
    selectedDomainId,
    includeDescendants,
    searchQuery: deferredSearch,
  };
  const { data: understandings, isLoading } = useCaptureUnderstandingList(filterKey);
  const sorted = useMemo(
    () => sortUnderstandingSummaries(understandings ?? [], sortBy),
    [understandings, sortBy],
  );
  const items = useMemo(
    () =>
      sorted.map((understanding) => ({
        id: understanding.id,
        title: understanding.title ?? "未命名理解",
        meta: `更新于 ${formatDistanceToNow(new Date(understanding.updatedAt), {
          addSuffix: true,
          locale: zhCN,
        })}`,
      })),
    [sorted],
  );
  const canvasItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return (canvases ?? [])
      .filter((canvas) => canvas.id !== canvasId)
      .filter((canvas) => !query || canvas.title.toLocaleLowerCase().includes(query))
      .map((canvas) => ({ id: canvas.id, title: canvas.title }));
  }, [canvases, canvasId, searchQuery]);

  return (
    <CanvasLibraryPanelView
      tab={tab}
      items={items}
      domainTree={domains}
      canvases={canvasItems}
      loading={isLoading}
      domainsLoading={domainsLoading}
      canvasesLoading={canvasesLoading}
      searchQuery={searchQuery}
      selectedDomainId={selectedDomainId}
      includeDescendants={includeDescendants}
      sortBy={sortBy}
      onTabChange={setTab}
      onSearchQueryChange={setSearchQuery}
      onSelectedDomainIdChange={setSelectedDomainId}
      onIncludeDescendantsChange={setIncludeDescendants}
      onSortByChange={setSortBy}
      onClose={onClose}
      onStartDragUnderstanding={onStartDragUnderstanding}
      onPickUnderstanding={onPickUnderstanding}
      onStartDragCanvas={onStartDragCanvas}
      onPickCanvas={onPickCanvas}
    />
  );
}
