import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@reflecta/ui/components/button";
import { Input } from "@reflecta/ui/components/input";
import { useModal } from "@reflecta/ui/overlays";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import {
  useCaptureDomains,
  useCaptureUnderstandingList,
  useCaptureUnderstandingListTotal,
  useCreateUnderstandingMutation,
  useDeleteUnderstandingMutation,
} from "../queries";
import { sortUnderstandingSummaries } from "./sort";
import { CaptureStats } from "./CaptureStats";
import { CaptureCardGrid } from "./CaptureCardGrid";

function DomainFilterChips({
  selectedDomainId,
  onSelect,
}: {
  selectedDomainId: string;
  onSelect: (domainId: string) => void;
}) {
  const { domains } = useCaptureDomains();
  // chips 平铺根领域；子领域通过 includeDescendants 归入父领域筛选（Domain = cluster 标签语义）
  const roots = useMemo(() => domains.filter((domain) => !domain.parentId), [domains]);

  return (
    <div
      data-testid="capture-domain-filter"
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      aria-label="按领域筛选"
    >
      <Button
        type="button"
        size="sm"
        variant={selectedDomainId === "all" ? "secondary" : "ghost"}
        className="px-2.5"
        onClick={() => onSelect("all")}
      >
        全部
      </Button>
      {roots.map((domain) => (
        <Button
          key={domain.id}
          type="button"
          size="sm"
          variant={selectedDomainId === domain.id ? "secondary" : "ghost"}
          className="max-w-36 px-2.5"
          onClick={() => onSelect(domain.id)}
        >
          <span className="truncate">{domain.name}</span>
        </Button>
      ))}
    </div>
  );
}

export function CaptureDashboard({ onChat }: { onChat?: (scope: CaptureAgentScope) => void }) {
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const searchQuery = useCaptureStore((state) => state.searchQuery);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const setSearchQuery = useCaptureStore((state) => state.setSearchQuery);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );
  const { confirm } = useModal();
  const createUnderstandingMutation = useCreateUnderstandingMutation();
  const deleteUnderstandingMutation = useDeleteUnderstandingMutation();

  const listFilter = useMemo(
    () => ({
      selectedDomainId,
      includeDescendants: true,
      searchQuery: searchQuery.trim(),
    }),
    [selectedDomainId, searchQuery],
  );
  const { data: listData } = useCaptureUnderstandingList(listFilter);
  const { data: totalData } = useCaptureUnderstandingListTotal({
    selectedDomainId,
    includeDescendants: true,
  });
  const displayedUnderstandings = useMemo(
    () => sortUnderstandingSummaries(listData ?? [], "updatedAt"),
    [listData],
  );
  const statsUnderstandings = useMemo(() => totalData ?? [], [totalData]);

  const createEmptyUnderstanding = useCallback(async () => {
    const dto = await createUnderstandingMutation.mutateAsync({
      title: "",
      body: "",
      domainIds: selectedDomainId !== "all" ? [selectedDomainId] : [],
    });
    selectUnderstanding(dto.id);
  }, [createUnderstandingMutation, selectUnderstanding, selectedDomainId]);

  const handleDelete = useCallback(
    (understandingId: string) => {
      confirm({
        title: "删除理解",
        message: "确定要删除这条理解吗？此操作不可撤销。",
        acceptLabel: "删除",
        danger: true,
        onAccept: async () => {
          await deleteUnderstandingMutation.mutateAsync(understandingId);
          resetAfterUnderstandingDeleted(understandingId);
        },
      });
    },
    [confirm, deleteUnderstandingMutation, resetAfterUnderstandingDeleted],
  );

  return (
    <section
      data-testid="capture-dashboard"
      className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden px-4 pt-2 pb-4"
    >
      <header
        data-testid="capture-dashboard-header"
        className="app-drag-region flex shrink-0 flex-wrap items-center gap-2"
      >
        <DomainFilterChips selectedDomainId={selectedDomainId} onSelect={selectDomain} />
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2" data-no-drag>
          <Input
            data-testid="capture-dashboard-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="查找已有理解"
            className="h-8 w-52"
          />
          <Button
            data-testid="capture-create-understanding-button"
            type="button"
            size="sm"
            onClick={() => void createEmptyUnderstanding()}
          >
            <Plus size={14} />
            新建理解
          </Button>
        </div>
      </header>

      <CaptureStats understandings={statsUnderstandings} />

      <CaptureCardGrid
        understandings={displayedUnderstandings}
        selectedUnderstandingId={selectedUnderstandingId}
        searchActive={searchQuery.trim().length > 0}
        onSelect={selectUnderstanding}
        onChat={onChat}
        onDelete={handleDelete}
      />
    </section>
  );
}
