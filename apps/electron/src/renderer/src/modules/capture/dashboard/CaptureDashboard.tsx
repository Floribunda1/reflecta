import { ArrowUpDown, GitBranch, Plus, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "ahooks";
import { Button } from "@reflecta/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@reflecta/ui/components/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@reflecta/ui/components/dropdown-menu";
import { useModal } from "@reflecta/ui/overlays";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import {
  useCaptureUnderstandingList,
  useCreateUnderstandingMutation,
  useDeleteUnderstandingMutation,
} from "../queries";
import { PageTopBar } from "@renderer/modules/shared/layout/PageTopBar";
import { sortUnderstandingSummaries, type UnderstandingListSortBy } from "./sort";
import { CaptureCardGrid } from "./CaptureCardGrid";
import { ParticipationOverview, ParticipationOverviewToggle } from "./ParticipationOverview";

/**
 * 搜索输入：本地即时输入 + 300ms 防抖写入 store；IME 组合期（isComposing）不推送，
 * 组合结束立即推送最终结果，避免中文输入过程中频繁触发查询。
 */
function useSearchQueryControl() {
  const setSearchQuery = useCaptureStore((state) => state.setSearchQuery);
  const [text, setText] = useState(() => useCaptureStore.getState().searchQuery);
  const composingRef = useRef(false);
  const debouncedText = useDebounce(text, { wait: 300 });

  useEffect(() => {
    if (!composingRef.current) setSearchQuery(debouncedText);
  }, [debouncedText, setSearchQuery]);

  return {
    searchText: text,
    onChangeText: (value: string) => setText(value),
    onCompositionStart: () => {
      composingRef.current = true;
    },
    onCompositionEnd: () => {
      composingRef.current = false;
      setSearchQuery(text);
    },
  };
}

/** 铺满 Capture 内容宽的顶栏；侧栏收起时汉堡出现在搜索左边。 */
export function CaptureToolbar() {
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const includeDescendants = useCaptureStore((state) => state.includeDescendants);
  const setIncludeDescendants = useCaptureStore((state) => state.setIncludeDescendants);
  const understandingListSortBy = useCaptureStore((state) => state.understandingListSortBy);
  const setUnderstandingListSortBy = useCaptureStore((state) => state.setUnderstandingListSortBy);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const createUnderstandingMutation = useCreateUnderstandingMutation();
  const { searchText, onChangeText, onCompositionStart, onCompositionEnd } =
    useSearchQueryControl();

  const createEmptyUnderstanding = useCallback(async () => {
    const dto = await createUnderstandingMutation.mutateAsync({
      title: "",
      body: "",
      domainIds: selectedDomainId !== "all" ? [selectedDomainId] : [],
    });
    selectUnderstanding(dto.id);
  }, [createUnderstandingMutation, selectUnderstanding, selectedDomainId]);

  return (
    <PageTopBar
      testId="capture-dashboard-toolbar"
      actions={
        <Button
          data-testid="capture-create-understanding-button"
          type="button"
          size="sm"
          onClick={() => void createEmptyUnderstanding()}
        >
          <Plus size={14} />
          新建理解
        </Button>
      }
    >
      <InputGroup className="w-64 shrink-0">
        <InputGroupAddon align="inline-start">
          <Search className="size-4 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          data-testid="capture-dashboard-search"
          value={searchText}
          onChange={(event) => onChangeText(event.target.value)}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          placeholder="查找已有理解"
        />
      </InputGroup>

      <Button
        type="button"
        size="icon-sm"
        variant={includeDescendants ? "secondary" : "ghost"}
        aria-label={includeDescendants ? "已包含子领域" : "未包含子领域"}
        title={includeDescendants ? "已包含子领域" : "未包含子领域"}
        onClick={() => setIncludeDescendants(!includeDescendants)}
      >
        <GitBranch size={14} />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant={understandingListSortBy === "createdAt" ? "secondary" : "ghost"}
              aria-label="排序理解"
            >
              <ArrowUpDown size={14} />
            </Button>
          }
        />
        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>排序</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={understandingListSortBy}
              onValueChange={(value) =>
                setUnderstandingListSortBy(value as UnderstandingListSortBy)
              }
            >
              <DropdownMenuRadioItem value="updatedAt">按更新时间</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="createdAt">按创建时间</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ParticipationOverviewToggle />
    </PageTopBar>
  );
}

export const CaptureDashboard = memo(function CaptureDashboard({
  onChat,
}: {
  onChat?: (scope: CaptureAgentScope) => void;
}) {
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const storeSearchQuery = useCaptureStore((state) => state.searchQuery);
  const includeDescendants = useCaptureStore((state) => state.includeDescendants);
  const understandingListSortBy = useCaptureStore((state) => state.understandingListSortBy);
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const resetAfterUnderstandingDeleted = useCaptureStore(
    (state) => state.resetAfterUnderstandingDeleted,
  );
  const { confirm } = useModal();
  const deleteUnderstandingMutation = useDeleteUnderstandingMutation();

  const listFilter = useMemo(
    () => ({
      selectedDomainId,
      includeDescendants,
      searchQuery: storeSearchQuery.trim(),
    }),
    [selectedDomainId, includeDescendants, storeSearchQuery],
  );
  const { data: listData } = useCaptureUnderstandingList(listFilter);
  const displayedUnderstandings = useMemo(
    () => sortUnderstandingSummaries(listData ?? [], understandingListSortBy),
    [listData, understandingListSortBy],
  );

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
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden pt-2 pb-4"
    >
      {/* 参与概览：热力图 + 资产指标同排（全局数据，不随领域/搜索筛选） */}
      <ParticipationOverview />

      <CaptureCardGrid
        understandings={displayedUnderstandings}
        searchActive={storeSearchQuery.trim().length > 0}
        onSelect={selectUnderstanding}
        onChat={onChat}
        onDelete={handleDelete}
      />
    </section>
  );
});
