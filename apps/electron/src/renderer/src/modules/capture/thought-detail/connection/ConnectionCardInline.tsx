import { defineComponent, PropType, computed, ref } from "vue";
import { useRouter } from "vue-router";
import type { ThoughtSummaryDTO, ThoughtType } from "@shared/thought";
import {
  SimpleMarkdownPreview,
  MarkdownPreview,
} from "@renderer/modules/shared/components/md-preview";
import { ThoughtTypeBadge } from "../ThoughtTypeBadge";
import ContextMenu from "primevue/contextmenu";
import Tag from "primevue/tag";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { searchEventBus } from "@renderer/utils/searchEventBus";

const inlineCardClass =
  "overflow-hidden rounded-xl border border-[var(--p-content-border-color)] bg-surface-0 transition-colors duration-150 hover:bg-surface-50";
const inlineCardHeaderClass = "flex cursor-pointer select-none items-center gap-2.5 p-2";
const inlineCardBodyClass = "flex min-w-0 flex-1 flex-col gap-1";
const inlineCardExpandedClass = "border-t border-[var(--p-content-border-color)] bg-surface-50 p-2";
const mutedMetaClass = "text-xs text-muted-color";
const mutedChevronClass = "text-xs shrink-0 text-muted-color";

export const ConnectionCardInline = defineComponent({
  name: "ConnectionCardInline",
  props: {
    thought: { type: Object as PropType<ThoughtSummaryDTO>, required: true },
    /** Direction from the current thought's perspective */
    direction: {
      type: String as PropType<"outgoing" | "incoming">,
      required: true,
    },
  },
  setup(props) {
    const router = useRouter();
    const cm = ref<InstanceType<typeof ContextMenu>>();
    const expanded = ref(false);

    const directionLabel = computed(() => (props.direction === "outgoing" ? "引用" : "被引用"));
    const directionIcon = computed(() =>
      props.direction === "outgoing" ? "pi pi-arrow-right" : "pi pi-arrow-left",
    );
    // Accent bar: outgoing = primary (引出方向); incoming = subdued (passive/background)
    const accentClass = computed(() =>
      props.direction === "outgoing" ? "bg-primary-400" : "bg-surface-300",
    );
    const menuItems = computed(() => {
      const items: Array<{
        label: string;
        icon: string;
        class?: string;
        command: () => void;
      }> = [];
      items.push({
        label: "查看笔记",
        icon: "pi pi-eye",
        command: () =>
          searchEventBus.emit("thoughtSelected", {
            thoughtId: props.thought.id,
            categoryIds: props.thought.categoryIds,
          }),
      });
      items.push({
        label: "查看关联",
        icon: "pi pi-sitemap",
        command: () =>
          router.push({ name: "Contemplate", query: { selectThoughtId: props.thought.id } }),
      });
      return items;
    });

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cm.value?.show(e);
    };

    return () => (
      <div onContextmenu={handleContextMenu}>
        {menuItems.value.length > 0 && <ContextMenu ref={cm} model={menuItems.value} />}
        <div class={inlineCardClass}>
          <div
            class={inlineCardHeaderClass}
            onClick={() =>
              searchEventBus.emit("thoughtSelected", {
                thoughtId: props.thought.id,
                categoryIds: props.thought.categoryIds,
              })
            }
          >
            <div class={`w-px shrink-0 self-stretch rounded-full ${accentClass.value}`} />
            <div class={inlineCardBodyClass}>
              <div class="flex items-center gap-1.5 min-w-0">
                <Tag value={directionLabel.value} icon={directionIcon.value} severity="secondary" />
                <ThoughtTypeBadge type={props.thought.type as ThoughtType} />
                {props.thought.title && (
                  <span class="font-medium flex-1 min-w-0 truncate text-sm text-color">
                    {props.thought.title}
                  </span>
                )}
                <span class={`${mutedMetaClass} ml-auto shrink-0`}>
                  {formatDistanceToNow(props.thought.updatedAt, {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
              {props.thought.body ? (
                <div>
                  <SimpleMarkdownPreview content={props.thought.body} lineClamp={3} />
                </div>
              ) : (
                !props.thought.title && <span class={`${mutedMetaClass}`}>（无内容）</span>
              )}
            </div>
            <button
              class="shrink-0 rounded p-1 text-muted-color transition-colors hover:bg-surface-100 hover:text-color"
              title={expanded.value ? "收起预览" : "展开预览"}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                expanded.value = !expanded.value;
              }}
            >
              <i class={`pi pi-chevron-${expanded.value ? "up" : "down"} ${mutedChevronClass}`} />
            </button>
          </div>
          {expanded.value && (
            <div class={inlineCardExpandedClass}>
              <MarkdownPreview content={props.thought.body} />
            </div>
          )}
        </div>
      </div>
    );
  },
});
