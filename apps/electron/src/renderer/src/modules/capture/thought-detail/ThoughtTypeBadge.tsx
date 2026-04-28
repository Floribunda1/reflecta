import { defineComponent, PropType } from "vue";
import type { ThoughtType } from "@shared/thought";
import Tag from "primevue/tag";

const BADGE_CONFIG: Record<string, { label: string; icon: string; ptClass: string }> = {
  idea: {
    label: "Idea",
    icon: "pi pi-lightbulb",
    ptClass:
      "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700",
  },
  insight: {
    label: "Insight",
    icon: "pi pi-star",
    ptClass:
      "rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700",
  },
};

export const ThoughtTypeBadge = defineComponent({
  name: "ThoughtTypeBadge",
  props: {
    type: { type: String as PropType<ThoughtType>, required: true },
  },
  setup(props) {
    return () => {
      const cfg = BADGE_CONFIG[props.type];
      return <Tag value={cfg.label} icon={cfg.icon} pt={{ root: { class: cfg.ptClass } }} />;
    };
  },
});
