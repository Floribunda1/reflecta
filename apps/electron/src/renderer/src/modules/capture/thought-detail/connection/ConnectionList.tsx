import { defineComponent, computed, PropType } from "vue";
import { useThoughtDetailContext } from "../context";
import { ConnectionCardInline } from "./ConnectionCardInline";
import Button from "primevue/button";

const emptyActionClass =
  "flex select-none items-center justify-center rounded-md border border-dashed border-[var(--p-content-border-color)] bg-transparent px-3 py-6";
const emptyIconClass = "text-2xl text-muted-color";
const mutedMetaClass = "text-xs text-muted-color";

export const ConnectionList = defineComponent({
  name: "ConnectionList",
  props: {
    onViewGraph: {
      type: Function as PropType<() => void>,
      required: false,
    },
  },
  setup(props) {
    const { thought } = useThoughtDetailContext()!;

    const outgoing = computed(() => thought.value?.connections ?? []);
    const incoming = computed(() => thought.value?.referencedBy ?? []);

    const hasConnections = computed(() => outgoing.value.length > 0 || incoming.value.length > 0);

    return () => (
      <div class="flex flex-col gap-3">
        {hasConnections.value ? (
          <>
            <div class="flex flex-col gap-2">
              {outgoing.value.length > 0 && (
                <div class="flex flex-col gap-1">
                  {incoming.value.length > 0 && (
                    <span class={`${mutedMetaClass} font-medium`}>引用</span>
                  )}
                  {outgoing.value.map((t) => (
                    <ConnectionCardInline key={t.id} thought={t} direction="outgoing" />
                  ))}
                </div>
              )}
              {incoming.value.length > 0 && (
                <div class="flex flex-col gap-1">
                  {outgoing.value.length > 0 && (
                    <span class={`${mutedMetaClass} font-medium`}>被引用</span>
                  )}
                  {incoming.value.map((t) => (
                    <ConnectionCardInline key={t.id} thought={t} direction="incoming" />
                  ))}
                </div>
              )}
            </div>
            <div
              class={["flex items-center", props.onViewGraph ? "justify-between" : "justify-start"]}
            >
              {props.onViewGraph && (
                <Button
                  label="查看关联"
                  icon="pi pi-share-alt"
                  severity="secondary"
                  size="small"
                  text
                  onClick={props.onViewGraph}
                />
              )}
            </div>
          </>
        ) : (
          <div class={emptyActionClass}>
            <i class={`pi pi-link ${emptyIconClass}`} />
          </div>
        )}
      </div>
    );
  },
});
