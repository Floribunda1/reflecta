import { defineComponent, ref, computed, nextTick } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import { useQuery } from "@tanstack/vue-query";
import { ipcClient } from "@renderer/utils/ipc";
import { searchEventBus } from "@renderer/utils/searchEventBus";
import type { ThoughtSummaryDTO, ThoughtType } from "@shared/thought";
import type { FtsContextResult } from "@shared/search";
import { SimpleMarkdownPreview } from "../components/md-preview";

type SuggestionItem =
  | { kind: "thought"; data: ThoughtSummaryDTO }
  | { kind: "context"; data: FtsContextResult };

const TYPE_CONFIG: Record<ThoughtType, { label: string; icon: string; className: string }> = {
  idea: {
    label: "Idea",
    icon: "pi pi-lightbulb",
    className: "border-amber-200/80 bg-amber-50/70 text-amber-800",
  },
  insight: {
    label: "Insight",
    icon: "pi pi-star",
    className: "border-violet-200/80 bg-violet-50/70 text-violet-700",
  },
};

const typeBadgeClass =
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";

export const GlobalSearch = defineComponent({
  name: "GlobalSearch",
  setup() {
    const visible = ref(false);
    const inputValue = ref<string>("");
    const searchQuery = ref<string>("");
    const inputRef = ref<InstanceType<typeof InputText> | null>(null);

    const { data: searchResult, isFetching } = useQuery({
      queryKey: computed(() => ["search", searchQuery.value] as const),
      queryFn: () => ipcClient.search.search(searchQuery.value),
      enabled: computed(() => searchQuery.value.length > 0),
    });

    const results = computed<SuggestionItem[]>(() => {
      if (!searchResult.value) return [];
      return [
        ...searchResult.value.thoughts.map((t) => ({ kind: "thought" as const, data: t })),
        ...searchResult.value.contexts.map((c) => ({ kind: "context" as const, data: c })),
      ];
    });

    const openDialog = () => {
      visible.value = true;
      nextTick(() => {
        (inputRef.value as unknown as HTMLInputElement | null)?.focus();
      });
    };

    const closeAndReset = () => {
      visible.value = false;
      inputValue.value = "";
      searchQuery.value = "";
    };

    const handleSelect = (item: SuggestionItem) => {
      if (item.kind === "thought") {
        searchEventBus.emit("thoughtSelected", {
          thoughtId: item.data.id,
          categoryIds: item.data.categoryIds,
        });
      } else {
        searchEventBus.emit("thoughtSelected", {
          thoughtId: item.data.thoughtId,
          categoryIds: undefined,
        });
      }
      closeAndReset();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchQuery.value = inputValue.value;
      }
    };

    const renderThought = (thought: ThoughtSummaryDTO) => {
      const cfg = TYPE_CONFIG[thought.type];
      return (
        <div
          class="cursor-pointer border-b border-surface-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-50"
          onClick={() => handleSelect({ kind: "thought", data: thought })}
        >
          <div class="flex min-w-0 items-center gap-2">
            <span class={[typeBadgeClass, cfg.className]}>
              <i class={cfg.icon} />
              {cfg.label}
            </span>
            {thought.title && (
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-color">
                {thought.title}
              </span>
            )}
          </div>
          <div class="mt-1 min-w-0 overflow-hidden text-[13px] leading-5 text-muted-color">
            {thought.body ? (
              <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
            ) : (
              !thought.title && <span class="italic text-muted-color">无内容</span>
            )}
          </div>
        </div>
      );
    };

    const renderContext = (ctx: FtsContextResult) => (
      <div
        class="cursor-pointer border-b border-surface-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-50"
        onClick={() => handleSelect({ kind: "context", data: ctx })}
      >
        <div class="flex min-w-0 items-center gap-2">
          <span class={[typeBadgeClass, "border-sky-200/80 bg-sky-50/70 text-sky-700"]}>
            <i class="pi pi-link" />
            Context
          </span>
          {ctx.sourceName && (
            <span class="min-w-0 flex-1 truncate text-sm font-semibold text-color">
              {ctx.sourceName}
            </span>
          )}
        </div>
        <div
          class="mt-1 min-w-0 overflow-hidden text-[13px] leading-5 text-muted-color"
          innerHTML={ctx.snippet}
        />
      </div>
    );

    return () => (
      <>
        <Button
          icon="pi pi-search"
          severity="secondary"
          variant="text"
          aria-label="搜索"
          onClick={openDialog}
        />

        <Dialog
          v-model:visible={visible.value}
          modal
          showHeader={false}
          dismissableMask={true}
          style={{ width: "720px", maxWidth: "calc(100vw - 32px)" }}
          pt={{
            root: { class: "!overflow-hidden" },
            content: { class: "flex max-h-[72vh] flex-col !p-0" },
          }}
          {...{ onHide: closeAndReset }}
        >
          <div class="border-b border-surface-100 p-3">
            <div class="flex items-center gap-2">
              <InputText
                ref={inputRef}
                v-model={inputValue.value}
                placeholder="搜索 Thought 或 Context"
                autofocus
                fluid
                {...{ onKeydown: handleKeydown }}
              />
              <span class="shrink-0 rounded border border-surface-200 px-1.5 py-0.5 text-[11px] text-muted-color">
                Enter
              </span>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
            {isFetching.value && (
              <div class="flex items-center justify-center py-10 text-sm text-muted-color">
                <i class="pi pi-spinner pi-spin mr-2" />
                搜索中…
              </div>
            )}

            {!isFetching.value && searchQuery.value && results.value.length === 0 && (
              <div class="flex items-center justify-center py-10 text-sm text-muted-color">
                未找到匹配结果
              </div>
            )}

            {!searchQuery.value && (
              <div class="flex items-center justify-center py-10 text-sm text-muted-color">
                输入关键词后按 Enter
              </div>
            )}

            {results.value.length > 0 && (
              <div class="flex flex-col">
                {results.value.map((item) =>
                  item.kind === "thought" ? renderThought(item.data) : renderContext(item.data),
                )}
              </div>
            )}
          </div>
        </Dialog>
      </>
    );
  },
});
