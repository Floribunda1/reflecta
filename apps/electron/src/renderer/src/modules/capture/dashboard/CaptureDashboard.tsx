import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@reflecta/ui/components/button";
import { Input } from "@reflecta/ui/components/input";
import { useModal } from "@reflecta/ui/overlays";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import {
  useCaptureUnderstandingList,
  useCreateUnderstandingMutation,
  useDeleteUnderstandingMutation,
} from "../queries";
import { sortUnderstandingSummaries } from "./sort";
import { CaptureCardGrid } from "./CaptureCardGrid";

export function CaptureDashboard({ onChat }: { onChat?: (scope: CaptureAgentScope) => void }) {
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const selectedUnderstandingId = useCaptureStore((state) => state.selectedUnderstandingId);
  const searchQuery = useCaptureStore((state) => state.searchQuery);
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
  const displayedUnderstandings = useMemo(
    () => sortUnderstandingSummaries(listData ?? [], "updatedAt"),
    [listData],
  );

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
      <div
        data-testid="capture-dashboard-toolbar"
        className="flex shrink-0 items-center gap-2"
        data-no-drag
      >
        <Input
          data-testid="capture-dashboard-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="查找已有理解"
          className="h-8 w-64"
        />
        <div className="ml-auto" />
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
