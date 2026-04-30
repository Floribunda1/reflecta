import { defineComponent, ref, computed, watch, PropType } from "vue";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { CategoryTreeSelect } from "@renderer/modules/shared/biz-components/CategoryTreeSelect";
import {
  SimpleMarkdownPreview,
  MarkdownPreview,
} from "@renderer/modules/shared/components/md-preview";
import { ThoughtTypeBadge } from "../ThoughtTypeBadge";
import { useSharedDrawer } from "@renderer/modules/shared/hooks/use-drawer";
import InputText from "primevue/inputtext";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import Button from "primevue/button";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

const inlineCardHeaderClass = "flex cursor-pointer select-none items-start gap-2.5 px-3 py-2.5";
const inlineCardBodyClass = "flex min-w-0 flex-1 flex-col gap-1.5";
const inlineCardExpandedClass =
  "border-t border-[var(--p-content-border-color)] bg-surface-50 px-3 py-2.5";
const mutedMetaClass = "text-xs text-muted-color";
const mutedChevronClass = "text-xs shrink-0 text-muted-color";
const emptyIconClass = "text-2xl text-muted-color";

export const AddConnectionDrawer = defineComponent({
  name: "AddConnectionDrawer",
  props: {
    handleConfirm: {
      type: Function as PropType<(targetId: string) => unknown | Promise<unknown>>,
      required: true,
    },
    excludeIds: {
      type: Array as () => string[],
      default: () => [],
    },
    defaultCategoryId: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
  setup(props) {
    const { closeDrawer } = useSharedDrawer();

    const searchQuery = ref("");
    const selectedCategoryIds = ref<string[]>(
      props.defaultCategoryId ? [props.defaultCategoryId] : [],
    );
    const allThoughts = ref<ThoughtSummaryDTO[]>([]);
    const loading = ref(false);
    const selected = ref<ThoughtSummaryDTO | null>(null);
    const expandedMap = ref<Record<string, boolean>>({});

    const excludeSet = computed(() => new Set(props.excludeIds));

    const filteredThoughts = computed(() =>
      allThoughts.value.filter((t) => !excludeSet.value.has(t.id)),
    );

    const loadThoughts = async (q: string, catIds: string[]) => {
      loading.value = true;
      try {
        const base = q ? { searchQuery: q } : {};
        let result: ThoughtSummaryDTO[];
        if (catIds.length === 0) {
          result = await ipcClient.thought.listThoughts(q ? base : undefined);
        } else if (catIds.length === 1) {
          result = await ipcClient.thought.listThoughts({
            ...base,
            categoryId: catIds[0],
            includeDescendants: true,
          });
        } else {
          const batches = await Promise.all(
            catIds.map((id) =>
              ipcClient.thought.listThoughts({
                ...base,
                categoryId: id,
                includeDescendants: true,
              }),
            ),
          );
          const seen = new Set<string>();
          result = [];
          for (const batch of batches) {
            for (const t of batch) {
              if (!seen.has(t.id)) {
                seen.add(t.id);
                result.push(t);
              }
            }
          }
        }
        allThoughts.value = result;
      } finally {
        loading.value = false;
      }
    };

    // Initial load
    loadThoughts("", selectedCategoryIds.value);

    let debounceTimer: ReturnType<typeof setTimeout>;
    watch(searchQuery, (q) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadThoughts(q, selectedCategoryIds.value), 300);
    });
    watch(selectedCategoryIds, (catIds) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadThoughts(searchQuery.value, catIds), 300);
    });

    return () => (
      <div class="flex h-full min-h-0 flex-col bg-surface-0">
        <div class="shrink-0 border-b border-[var(--p-content-border-color)] pb-3">
          <div class="flex flex-col gap-2">
            <IconField>
              <InputIcon class="pi pi-search" />
              <InputText
                value={searchQuery.value}
                onInput={(e) => {
                  searchQuery.value = (e.target as HTMLInputElement).value;
                }}
                placeholder="搜索 Thought…"
                size="small"
                class="w-full"
              />
            </IconField>
            <CategoryTreeSelect variant="inline" v-model={selectedCategoryIds.value} />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto py-3">
          {loading.value ? (
            <div class="flex items-center justify-center py-12">
              <i class={`pi pi-spin pi-spinner ${emptyIconClass}`} />
            </div>
          ) : filteredThoughts.value.length === 0 ? (
            <div class="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <i class={`pi pi-search text-3xl text-muted-color`} />
              <div class="flex flex-col gap-1">
                <p class="text-sm font-medium text-muted-color">
                  {searchQuery.value ? "没有找到相关 Thought" : "暂无可连接的 Thought"}
                </p>
                {searchQuery.value && <p class="text-sm text-muted-color">换个关键词试试</p>}
              </div>
            </div>
          ) : (
            <div class="flex flex-col overflow-hidden rounded-lg border border-[var(--p-content-border-color)] bg-surface-0">
              {filteredThoughts.value.map((t) => {
                const isSelected = selected.value?.id === t.id;
                const isExpanded = expandedMap.value[t.id];
                return (
                  <div
                    key={t.id}
                    class={[
                      "border-b border-[var(--p-content-border-color)] last:border-b-0 transition-colors duration-150",
                      isSelected ? "bg-primary-50" : "bg-surface-0 hover:bg-surface-50",
                    ]}
                    onClick={() => {
                      selected.value = isSelected ? null : t;
                    }}
                  >
                    <div class={inlineCardHeaderClass}>
                      <div
                        class={`mt-1 h-4 w-4 shrink-0 rounded-full border ${isSelected ? "border-primary bg-primary text-primary-contrast" : "border-surface-300 bg-transparent"}`}
                      />
                      <div class={inlineCardBodyClass}>
                        <div class="flex min-w-0 items-center gap-2">
                          <ThoughtTypeBadge type={t.type} />
                          {t.title && (
                            <span class="min-w-0 flex-1 truncate text-sm font-semibold text-color">
                              {t.title}
                            </span>
                          )}
                          <span class={`${mutedMetaClass} ml-auto shrink-0`}>
                            {formatDistanceToNow(t.updatedAt, {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </span>
                          {isSelected && (
                            <i class="pi pi-check-circle text-xs shrink-0 text-primary" />
                          )}
                        </div>
                        {t.body ? (
                          <div class="text-sm leading-5 text-muted-color">
                            <SimpleMarkdownPreview content={t.body} lineClamp={2} />
                          </div>
                        ) : (
                          !t.title && <span class={`${mutedMetaClass}`}>（无内容）</span>
                        )}
                      </div>
                      <i
                        class={`pi pi-chevron-${isExpanded ? "up" : "down"} ${mutedChevronClass}`}
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          expandedMap.value = {
                            ...expandedMap.value,
                            [t.id]: !expandedMap.value[t.id],
                          };
                        }}
                      />
                    </div>
                    {isExpanded && t.body && (
                      <div class={inlineCardExpandedClass}>
                        <MarkdownPreview content={t.body} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div class="shrink-0 border-t border-[var(--p-content-border-color)] bg-surface-0 py-3">
          <div class="flex justify-end gap-2">
            <Button label="取消" severity="secondary" text onClick={closeDrawer} />
            <Button
              label="确认"
              disabled={!selected.value}
              onClick={async () => {
                if (!selected.value) return;
                await props.handleConfirm(selected.value.id);
                closeDrawer();
              }}
            />
          </div>
        </div>
      </div>
    );
  },
});
