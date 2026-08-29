import { useDeferredValue, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useAtomValue } from "@effect/atom-react";
import { CanvasLibraryPanel as CanvasLibraryPanelView } from "@reflecta/ui/canvas";
import {
  useCaptureDomains,
  useCaptureUnderstandingList,
  type UnderstandingListFilterKey,
} from "../../capture/queries";
import { useCanvasList } from "../queries";
import { sortUnderstandingSummaries } from "../../capture/dashboard/sort";
import { SimpleMarkdownPreview } from "../../capture/resolved-markdown";
import { libraryFiltersAtom, patchLibraryFilters } from "../library-prefs";

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
  onStartDragUnderstanding: (
    id: string,
    title: string,
    e: React.MouseEvent | React.PointerEvent,
  ) => void;
  onStartDragCanvas: (id: string, title: string, e: React.MouseEvent | React.PointerEvent) => void;
  onPickUnderstanding: (id: string, title: string) => void;
  onPickCanvas: (id: string, title: string) => void;
}) {
  const { domains, loading: domainsLoading } = useCaptureDomains();
  const { data: canvases, isLoading: canvasesLoading } = useCanvasList();
  const { tab, selectedDomainId, includeDescendants, searchQuery, sortBy } =
    useAtomValue(libraryFiltersAtom);

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
        body: understanding.body,
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
      renderMarkdown={SimpleMarkdownPreview}
      onTabChange={(next) => patchLibraryFilters({ tab: next })}
      onSearchQueryChange={(query) => patchLibraryFilters({ searchQuery: query })}
      onSelectedDomainIdChange={(domainId) => patchLibraryFilters({ selectedDomainId: domainId })}
      onIncludeDescendantsChange={(include) => patchLibraryFilters({ includeDescendants: include })}
      onSortByChange={(next) => patchLibraryFilters({ sortBy: next })}
      onClose={onClose}
      onStartDragUnderstanding={onStartDragUnderstanding}
      onPickUnderstanding={onPickUnderstanding}
      onStartDragCanvas={onStartDragCanvas}
      onPickCanvas={onPickCanvas}
    />
  );
}
