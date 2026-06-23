/** Graph canvas powered by React Flow. */
import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import type { Domain } from "@shared/domain";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { useContemplatePageContext } from "../context";
import { useUnderstandingsQuery } from "./useUnderstandingsQuery";
import { filterUnderstandingsByStatus } from "./data";
import { OverviewAtlas } from "./OverviewAtlas";
import { UnderstandingCanvas } from "./UnderstandingCanvas";
import { useCaptureDomains } from "../../capture/queries";

export function GraphCanvas() {
  const ctx = useContemplatePageContext();
  const { data: rawUnderstandings } = useUnderstandingsQuery(
    ctx.selectedDomainIds,
    ctx.showAllDescendants,
  );
  const { data: allRawUnderstandings } = useUnderstandingsQuery([], true);
  const { domainList } = useCaptureDomains();
  const isOverview = ctx.selectedDomainIds.length === 0;
  const understandings = useMemo(
    () =>
      rawUnderstandings
        ? filterUnderstandingsByStatus(rawUnderstandings, ctx.statusFilter)
        : undefined,
    [rawUnderstandings, ctx.statusFilter],
  );
  const allUnderstandings = useMemo(
    () =>
      allRawUnderstandings
        ? filterUnderstandingsByStatus(allRawUnderstandings, ctx.statusFilter)
        : undefined,
    [allRawUnderstandings, ctx.statusFilter],
  );
  const focusUnderstandings = useMemo(
    () => expandFocusUnderstandings(understandings, allUnderstandings),
    [understandings, allUnderstandings],
  );
  const hasActiveFilter = ctx.selectedDomainIds.length > 0 || ctx.statusFilter !== "all";
  const isEmpty = (isOverview ? allUnderstandings : focusUnderstandings)?.length === 0;

  if (isOverview && allUnderstandings && allUnderstandings.length > 0) {
    return (
      <OverviewAtlas
        domains={domainList}
        understandings={allUnderstandings}
        onSelectDomain={(domainId) => ctx.setSelectedDomainIds([domainId])}
      />
    );
  }

  return (
    <FocusGraph
      rawUnderstandings={understandings}
      understandings={focusUnderstandings}
      domains={domainList}
      hasActiveFilter={hasActiveFilter}
      isEmpty={isEmpty}
    />
  );
}

function expandFocusUnderstandings(
  focusUnderstandings: UnderstandingSummaryDTO[] | undefined,
  allUnderstandings: UnderstandingSummaryDTO[] | undefined,
) {
  if (!focusUnderstandings) return undefined;
  if (!allUnderstandings) return focusUnderstandings;
  const focusIds = new Set(focusUnderstandings.map((understanding) => understanding.id));
  const allById = new Map(
    allUnderstandings.map((understanding) => [understanding.id, understanding]),
  );
  const result = new Map(
    focusUnderstandings.map((understanding) => [understanding.id, understanding]),
  );

  for (const understanding of focusUnderstandings) {
    for (const id of understanding.connectionIds) {
      const external = allById.get(id);
      if (external && !focusIds.has(id)) result.set(id, external);
    }
  }

  for (const understanding of allUnderstandings) {
    if (focusIds.has(understanding.id)) continue;
    if (understanding.connectionIds.some((id) => focusIds.has(id)))
      result.set(understanding.id, understanding);
  }

  return [...result.values()];
}

function FocusGraph({
  rawUnderstandings,
  understandings,
  domains,
  hasActiveFilter,
  isEmpty,
}: {
  rawUnderstandings: UnderstandingSummaryDTO[] | undefined;
  understandings: UnderstandingSummaryDTO[] | undefined;
  domains: Domain[];
  hasActiveFilter: boolean;
  isEmpty: boolean | undefined;
}) {
  const ctx = useContemplatePageContext();

  return (
    <>
      <div className="contemplate-canvas h-full w-full">
        {understandings && rawUnderstandings && understandings.length > 0 && (
          <UnderstandingCanvas
            understandings={understandings}
            focusUnderstandings={rawUnderstandings}
            domains={domains}
            selectedUnderstandingId={ctx.selectedUnderstandingId}
            onSelectUnderstanding={ctx.setSelectedUnderstandingId}
          />
        )}
      </div>
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <div className="mb-3 flex justify-center text-muted-foreground">
              <GitBranch size={34} />
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {hasActiveFilter ? "当前筛选没有匹配的 Understanding" : "还没有 Understanding"}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {hasActiveFilter ? "调整状态或 Domain 筛选。" : "在左上角新建节点。"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
