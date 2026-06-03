import { defineComponent, ref, computed } from "vue";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";
import { useCapturePageContext } from "../context";
import { useThoughtListContext } from "./context";
import { useConfirm } from "primevue/useconfirm";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import ContextMenu from "primevue/contextmenu";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import { useRouter } from "vue-router";

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
      <div onContextmenu={handleContextMenu}>
        <ContextMenu ref={cm} model={menuItems} />
        <div
          class={[
            "group flex cursor-pointer flex-col gap-3 py-5 transition-colors duration-150 hover:bg-surface-50 px-8",
            isSelected.value ? "bg-surface-100" : "",
          ]}
          onClick={() => {
            capture.selectedThoughtId.value = props.thought.id;
          }}
        >
          {/* Title + meta */}
          <div class="flex min-w-0 items-baseline gap-3">
            {props.thought.title ? (
              <span class="truncate text-base font-semibold leading-snug text-color">
                {props.thought.title}
              </span>
            ) : (
              <span class="truncate text-base font-medium leading-snug text-muted-color">
                未命名 Thought
              </span>
            )}

            <div class="ml-auto flex shrink-0 items-baseline gap-3 text-sm leading-snug text-muted-color">
              {categoryNames.value.length > 0 && <span>{categoryNames.value[0]}</span>}
              <span>· {props.thought.connectionCount}</span>
              <span class="tabular-nums">
                {formatDistanceToNow(props.thought.updatedAt, {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </span>
            </div>
          </div>

          {/* Preview */}
          <div class="min-w-0 text-sm leading-relaxed text-muted-color line-clamp-2">
            {props.thought.body ? (
              <SimpleMarkdownPreview content={props.thought.body} />
            ) : (
              <span class="text-muted-color/40">还没有正文</span>
            )}
          </div>
        </div>
      </div>
    );
  },
});
