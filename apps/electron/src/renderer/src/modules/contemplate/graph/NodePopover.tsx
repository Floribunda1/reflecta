import { defineComponent, type PropType, Teleport, ref, watch, onMounted } from "vue";
import Card from "primevue/card";
import { computePosition, offset, flip, shift } from "@floating-ui/dom";
import type { VirtualElement } from "@floating-ui/dom";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/md-preview";

export interface NodePopoverData {
  title: string;
  body: string;
}

/** Floating popover rendered via Teleport that previews a hovered graph node. */
export const NodePopover = defineComponent({
  name: "NodePopover",
  props: {
    data: {
      type: Object as PropType<NodePopoverData>,
      required: true,
    },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  setup(props) {
    const floatingRef = ref<HTMLDivElement | null>(null);

    async function updatePosition() {
      const el = floatingRef.value;
      if (!el) return;

      const reference: VirtualElement = {
        getBoundingClientRect() {
          return DOMRect.fromRect({
            x: props.x,
            y: props.y,
            width: 0,
            height: 0,
          });
        },
      };

      const { x, y } = await computePosition(reference, el, {
        placement: "right-start",
        strategy: "fixed",
        middleware: [offset(16), flip(), shift({ padding: 8 })],
      });

      el.style.position = "fixed";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }

    watch(() => [props.x, props.y], updatePosition);
    onMounted(updatePosition);

    return () => (
      <Teleport to="body">
        <div ref={floatingRef} class="z-50 w-96 pointer-events-none">
          <Card
            v-slots={{
              ...(props.data.title && {
                title: () => props.data.title,
              }),
              ...(props.data.body && {
                content: () => <SimpleMarkdownPreview content={props.data.body} lineClamp={5} />,
              }),
            }}
          />
        </div>
      </Teleport>
    );
  },
});
