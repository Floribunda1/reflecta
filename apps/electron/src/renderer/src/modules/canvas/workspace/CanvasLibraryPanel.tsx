import { useDeferredValue, useMemo, useState } from "react";
import {
  CanvasLibraryPanel as CanvasLibraryPanelView,
  type CanvasLibrarySortBy,
} from "@reflecta/ui/canvas";
import {
  useCaptureDomains,
  useCaptureUnderstandingList,
  type UnderstandingListFilterKey,
} from "../../capture/queries";
import { sortUnderstandingSummaries } from "../../capture/dashboard/sort";
import type { DomainTreeNode } from "@shared/domain";

/** 扁平化领域树为「全部领域 + 各领域」选项（缩进体现层级）。 */
function flattenDomains(
  nodes: readonly DomainTreeNode[],
  depth = 0,
): Array<{ id: string; name: string; depth: number }> {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenDomains(node.children, depth + 1),
  ]);
}

/**
 * 库面板 Adapter（M5）：领域过滤 / 搜索 / 排序走 Capture query；展示由 UI 面板承担。
 */
export function CanvasLibraryPanel({
  onClose,
  onOpenCanvasRefPicker,
  onStartDragUnderstanding,
  onPickUnderstanding,
}: {
  onClose: () => void;
  onOpenCanvasRefPicker: () => void;
  onStartDragUnderstanding: (id: string, e: React.MouseEvent | React.PointerEvent) => void;
  onPickUnderstanding: (id: string) => void;
}) {
  const { domains } = useCaptureDomains();
  const [selectedDomainId, setSelectedDomainId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<CanvasLibrarySortBy>("updatedAt");

  const deferredSearch = useDeferredValue(searchQuery);
  const filterKey: UnderstandingListFilterKey = {
    selectedDomainId,
    includeDescendants: true,
    searchQuery: deferredSearch,
  };
  const { data: understandings, isLoading } = useCaptureUnderstandingList(filterKey);
  const sorted = useMemo(
    () => sortUnderstandingSummaries(understandings ?? [], sortBy),
    [understandings, sortBy],
  );
  const domainOptions = useMemo(() => flattenDomains(domains), [domains]);
  const items = useMemo(
    () =>
      sorted.map((understanding) => ({
        id: understanding.id,
        title: understanding.title ?? "未命名理解",
      })),
    [sorted],
  );

  return (
    <CanvasLibraryPanelView
      items={items}
      domains={domainOptions}
      loading={isLoading}
      searchQuery={searchQuery}
      selectedDomainId={selectedDomainId}
      sortBy={sortBy}
      onSearchQueryChange={setSearchQuery}
      onSelectedDomainIdChange={setSelectedDomainId}
      onSortByChange={setSortBy}
      onClose={onClose}
      onOpenCanvasRefPicker={onOpenCanvasRefPicker}
      onStartDragUnderstanding={onStartDragUnderstanding}
      onPickUnderstanding={onPickUnderstanding}
    />
  );
}
