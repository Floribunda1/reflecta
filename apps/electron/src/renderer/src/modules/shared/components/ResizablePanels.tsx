import { defineComponent, ref, onMounted, PropType, VNode } from "vue";

export interface PanelConfig {
  id: string;
  defaultSize: number;
  minSize?: number;
  collapsedSize?: number;
}

export const ResizablePanels = defineComponent({
  name: "ResizablePanels",
  props: {
    panels: {
      type: Array as PropType<PanelConfig[]>,
      required: true,
    },
    gutterSize: {
      type: Number,
      default: 4,
    },
  },
  setup(props, { slots, expose }) {
    const containerRef = ref<HTMLElement | null>(null);
    const sizes = ref<number[]>([]);
    const collapsedStates = ref<boolean[]>([]);
    const savedSizes = ref<Map<number, number>>(new Map());

    const init = () => {
      sizes.value = props.panels.map((p) => p.defaultSize);
      collapsedStates.value = props.panels.map(() => false);
    };

    const togglePanel = (index: number, collapsed: boolean) => {
      if (collapsedStates.value[index] === collapsed) return;

      const containerWidth = containerRef.value?.clientWidth || 1000;
      const collapsedPx = props.panels[index].collapsedSize || 32;
      const collapsedPercent = (collapsedPx / containerWidth) * 100;

      if (collapsed) {
        savedSizes.value.set(index, sizes.value[index]);
        sizes.value[index] = collapsedPercent;
      } else {
        const saved = savedSizes.value.get(index);
        if (saved !== undefined) {
          sizes.value[index] = saved;
        } else {
          sizes.value[index] = props.panels[index].defaultSize;
        }
        savedSizes.value.delete(index);
      }

      collapsedStates.value[index] = collapsed;
    };

    const startResize = (e: MouseEvent, index: number) => {
      e.preventDefault();
      const startX = e.pageX;
      const containerWidth = containerRef.value!.clientWidth;

      const panelEls = containerRef.value!.querySelectorAll<HTMLElement>(".resizable-panel");
      const startWidths = Array.from(panelEls).map((el) => el.offsetWidth);

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.pageX - startX;

        const leftMin = props.panels[index].minSize || 120;
        const rightMin = props.panels[index + 1].minSize || 120;

        const newLeft = startWidths[index] + dx;
        const newRight = startWidths[index + 1] - dx;

        if (newLeft < leftMin || newRight < rightMin) return;

        sizes.value[index] = (newLeft / containerWidth) * 100;
        if (index + 1 < props.panels.length - 1) {
          sizes.value[index + 1] = (newRight / containerWidth) * 100;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    expose({ togglePanel });

    onMounted(init);

    return () => {
      const elements: VNode[] = [];

      for (let i = 0; i < props.panels.length; i++) {
        const p = props.panels[i];
        const collapsed = collapsedStates.value[i];
        const isLast = i === props.panels.length - 1;

        const style: Record<string, string> = {};
        if (collapsed) {
          style.flex = `0 0 ${p.collapsedSize || 32}px`;
        } else if (isLast) {
          style.flex = "1 1 auto";
          style.minWidth = `${p.minSize || 120}px`;
        } else {
          style.flex = `0 0 ${sizes.value[i]}%`;
          style.minWidth = `${p.minSize || 120}px`;
        }

        elements.push(
          <div
            key={p.id}
            class={[
              "resizable-panel",
              "h-full",
              "overflow-hidden",
              "flex",
              "flex-col",
              p.id === "category" ? "bg-surface-0" : "bg-surface-0",
              collapsed ? "items-center border-r border-surface-200" : "",
            ].join(" ")}
            style={style}
          >
            {slots[p.id]?.()}
          </div>,
        );

        if (!isLast && !collapsed && !collapsedStates.value[i + 1]) {
          elements.push(
            <div
              key={`gutter-${i}`}
              class="resizable-gutter h-full shrink-0 bg-surface-200/80 hover:bg-surface-300 cursor-col-resize transition-colors"
              style={{ width: `${props.gutterSize}px` }}
              onMousedown={(e) => startResize(e, i)}
            />,
          );
        }
      }

      return (
        <div ref={containerRef} class="flex h-full w-full select-none">
          {elements}
        </div>
      );
    };
  },
});
