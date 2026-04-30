import { defineComponent, ref, computed, PropType } from "vue";
import {
  SimpleMarkdownPreview,
  MarkdownPreview,
} from "@renderer/modules/shared/components/md-preview";
import type { ContextDTO } from "@shared/context";
import { useConfirm } from "primevue/useconfirm";

import ContextMenu from "primevue/contextmenu";
import { SOURCE_META } from "./types";
import { SourceType } from "@shared/context";

/** Source type → Tailwind color for the left accent bar and label */
const SOURCE_BAR_COLOR: Record<SourceType, string> = {
  experience: "bg-emerald-400",
  video: "bg-rose-400",
  book: "bg-teal-400",
  article: "bg-teal-400",
  opinion: "bg-purple-400",
  ai: "bg-amber-400",
};

const SOURCE_TEXT_COLOR: Record<SourceType, string> = {
  experience: "text-emerald-600",
  video: "text-rose-600",
  book: "text-teal-600",
  article: "text-teal-600",
  opinion: "text-purple-600",
  ai: "text-amber-600",
};

const inlineCardClass =
  "overflow-hidden rounded-xl border border-[var(--p-content-border-color)] bg-surface-0 transition-colors duration-150 hover:bg-surface-50";
const inlineCardHeaderClass = "flex cursor-pointer select-none items-center gap-2.5 p-2.5";
const inlineCardBodyClass = "flex min-w-0 flex-1 flex-col gap-1";
const inlineCardExpandedClass = "border-t border-[var(--p-content-border-color)] bg-surface-50 p-2";
const mutedMetaClass = "text-xs text-muted-color";
const mutedChevronClass = "text-xs shrink-0 text-muted-color";

export const ContextCardInline = defineComponent({
  name: "ContextCardInline",
  props: {
    context: { type: Object as PropType<ContextDTO>, required: true },
    onEdit: { type: Function as PropType<() => void>, required: true },
    onDelete: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const confirm = useConfirm();
    const expanded = ref(false);
    const cm = ref<InstanceType<typeof ContextMenu>>();

    const meta = computed(() => SOURCE_META[props.context.sourceType]);
    const barColor = computed(() => SOURCE_BAR_COLOR[props.context.sourceType]);
    const textColor = computed(() => SOURCE_TEXT_COLOR[props.context.sourceType]);

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cm.value?.show(e);
    };

    const menuItems = [
      {
        label: "编辑",
        icon: "pi pi-pencil",
        command: () => props.onEdit(),
      },
      {
        label: "删除",
        icon: "pi pi-trash",
        class: "text-red-600",
        command: () =>
          confirm.require({
            message: "确定要删除这条 Context 吗？此操作不可撤销。",
            header: "删除确认",
            rejectLabel: "取消",
            acceptLabel: "删除",
            acceptClass: "p-button-danger",
            accept: props.onDelete,
          }),
      },
    ];

    return () => (
      <div onContextmenu={handleContextMenu}>
        <ContextMenu ref={cm} model={menuItems} />
        <div class={inlineCardClass}>
          <div
            class={inlineCardHeaderClass}
            onClick={() => {
              expanded.value = !expanded.value;
            }}
          >
            <div class={["w-px shrink-0 self-stretch rounded-full", barColor.value]} />
            <div class={inlineCardBodyClass}>
              <div class="flex items-center gap-1 flex-wrap">
                <i class={[meta.value.icon, "text-xs", textColor.value]} />
                <span class={["text-xs font-semibold", textColor.value]}>{meta.value.label}</span>
                {props.context.sourceName && (
                  <span class={`${mutedMetaClass} flex-1 truncate`}>
                    — {props.context.sourceName}
                  </span>
                )}
              </div>
              <SimpleMarkdownPreview content={props.context.content} lineClamp={2} />
            </div>
            <i class={`pi pi-chevron-${expanded.value ? "up" : "down"} ${mutedChevronClass}`} />
          </div>
          {expanded.value && (
            <div class={inlineCardExpandedClass}>
              <MarkdownPreview content={props.context.content} />
            </div>
          )}
        </div>
      </div>
    );
  },
});
