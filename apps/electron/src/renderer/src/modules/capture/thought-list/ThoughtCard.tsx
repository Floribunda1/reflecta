import { defineComponent, ref, computed } from "vue";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useCapturePageContext } from "../context";
import { ThoughtTypeBadge } from "../thought-detail/ThoughtTypeBadge";
import { useThoughtListContext } from "./context";
import { useConfirm } from "primevue/useconfirm";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import ContextMenu from "primevue/contextmenu";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import { useRouter } from "vue-router";
import { SOURCE_META } from "../thought-detail/context/types";

const categoryChipClass =
  "rounded-full border border-[var(--p-content-border-color)] bg-transparent px-1.5 py-0.5 text-xs text-muted-color";

export const ThoughtCard = defineComponent({
  name: "ThoughtCard",
  props: {
    thought: { type: Object as () => ThoughtSummaryDTO, required: true },
  },
  setup(props) {
    const capture = useCapturePageContext()!;
    const thoughtListCtx = useThoughtListContext()!;
    const confirm = useConfirm();
    const router = useRouter();
    const { categoryList } = useCategoryData();

    const categoryNames = computed(() => {
      const map = new Map((categoryList.value ?? []).map((c) => [c.id, c.name]));
      return props.thought.categoryIds.map((id) => map.get(id)).filter(Boolean) as string[];
    });

    const cm = ref<InstanceType<typeof ContextMenu>>();
    const menuItems = [
      {
        label: "查看关联",
        icon: "pi pi-share-alt",
        command: () => {
          router.push({
            name: "Contemplate",
            query: { selectThoughtId: props.thought.id },
          });
        },
      },
      {
        label: "删除",
        icon: "pi pi-trash",
        class: "text-red-600",
        command: () => openDeleteConfirm(),
      },
    ];

    const isSelected = computed(() => capture.selectedThoughtId.value === props.thought.id);
    const shouldShowCategory = computed(() => categoryNames.value.length > 0);
    const primaryContext = computed(() => props.thought.contexts[0] ?? null);
    const contextCue = computed(() => {
      const ctx = primaryContext.value;
      if (!ctx) return null;
      const source = ctx.sourceName || SOURCE_META[ctx.sourceType].label;
      return {
        icon: SOURCE_META[ctx.sourceType].icon,
        source,
        count: props.thought.contexts.length,
      };
    });

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cm.value?.show(e);
    };

    const openDeleteConfirm = () => {
      confirm.require({
        message: "确定要删除这条 Thought 吗？此操作不可撤销。",
        header: "删除确认",
        rejectLabel: "取消",
        acceptLabel: "删除",
        acceptClass: "p-button-danger",
        rejectProps: { severity: "secondary" },
        accept: () => thoughtListCtx.deleteThought(props.thought.id),
      });
    };

    return () => (
      <div class="h-full" onContextmenu={handleContextMenu}>
        <ContextMenu ref={cm} model={menuItems} />
        <div
          class={[
            "flex h-full cursor-pointer flex-col rounded-xl border border-[var(--p-content-border-color)] bg-surface-0 p-4 shadow-none transition-colors duration-150 hover:bg-surface-50",
            isSelected.value ? "border-primary-200 bg-primary-50" : "",
          ]}
          onClick={() => {
            capture.selectedThoughtId.value = props.thought.id;
          }}
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <ThoughtTypeBadge type={props.thought.type} />
            <div class="min-w-0 flex-1">
              {props.thought.title ? (
                <span class="block truncate text-lg font-semibold leading-tight text-color">
                  {props.thought.title}
                </span>
              ) : (
                <span class="block truncate text-lg font-medium text-muted-color">
                  未命名 Thought
                </span>
              )}
            </div>
          </div>

          <div class="mt-3 flex flex-1 flex-col text-sm leading-normal text-muted-color">
            {props.thought.body ? (
              <SimpleMarkdownPreview content={props.thought.body} lineClamp={3} />
            ) : (
              <span class="text-sm text-muted-color">还没有正文</span>
            )}
          </div>

          <div class="mt-3 flex flex-col gap-2 border-t border-[var(--p-content-border-color)] pt-3">
            {contextCue.value && (
              <div class="flex min-w-0 items-center gap-1.5 text-sm text-muted-color">
                <i class={`${contextCue.value.icon} shrink-0 text-xs text-muted-color`} />
                <span class="min-w-0 truncate">{contextCue.value.source}</span>
                {contextCue.value.count > 1 && (
                  <span class="shrink-0 tabular-nums">+{contextCue.value.count - 1}</span>
                )}
              </div>
            )}
            {shouldShowCategory.value && (
              <div class="flex flex-wrap gap-1.5">
                {categoryNames.value.slice(0, 2).map((name) => (
                  <span key={name} class={categoryChipClass}>
                    {name}
                  </span>
                ))}
                {categoryNames.value.length > 2 && (
                  <span class={categoryChipClass}>+{categoryNames.value.length - 2}</span>
                )}
              </div>
            )}
            <div class="flex items-center justify-between gap-3 text-sm text-muted-color">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1">
                  <i class="pi pi-paperclip text-sm" />
                  <span>{props.thought.contexts.length}</span>
                </div>
                <div class="flex items-center gap-1">
                  <i class="pi pi-link text-sm" />
                  <span>{props.thought.connections.length}</span>
                </div>
              </div>
              <span>
                {formatDistanceToNow(props.thought.updatedAt, {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
});
