import { defineComponent, computed, PropType } from "vue";
import { useThoughtDetailContext } from "../context";
import { ConnectionCardInline } from "./ConnectionCardInline";
import { AddConnectionDrawer } from "./AddConnectionDrawer";
import { useSharedDrawer } from "@renderer/modules/shared/hooks/use-drawer";
import Button from "primevue/button";

const emptyActionClass =
  "flex cursor-pointer select-none items-center justify-center rounded-md border border-dashed border-[var(--p-content-border-color)] bg-transparent px-3 py-6 transition-colors duration-150 hover:bg-surface-50";
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
    const { thought, addConnection, removeConnection, removeIncomingConnection } =
      useThoughtDetailContext()!;
    const { openDrawer } = useSharedDrawer();

    const outgoing = computed(() => thought.value?.connections ?? []);
    const incoming = computed(() => thought.value?.referencedBy ?? []);

    const allConnectedIds = computed(() => [
      thought.value?.id ?? "",
      ...outgoing.value.map((t) => t.id),
      ...incoming.value.map((t) => t.id),
    ]);

    const hasConnections = computed(() => outgoing.value.length > 0 || incoming.value.length > 0);

    const handleAdd = () => {
      openDrawer(
        {
          position: "right",
          style: { width: "620px", maxWidth: "100vw" },
          header: "新增 Connection",
          pt: {
            title: { class: "!text-[1.5rem] !font-semibold !leading-none" },
            content: { class: "!pt-0" },
          },
        },
        <AddConnectionDrawer
          excludeIds={allConnectedIds.value}
          defaultCategoryId={thought.value?.categoryIds?.[0] ?? null}
          handleConfirm={async (targetId: string) => {
            await addConnection(targetId);
          }}
        />,
      );
    };

    const handleRemove = async (targetId: string) => {
      await removeConnection(targetId);
    };

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
                    <ConnectionCardInline
                      key={t.id}
                      thought={t}
                      direction="outgoing"
                      onRemove={() => handleRemove(t.id)}
                    />
                  ))}
                </div>
              )}
              {incoming.value.length > 0 && (
                <div class="flex flex-col gap-1">
                  {outgoing.value.length > 0 && (
                    <span class={`${mutedMetaClass} font-medium`}>被引用</span>
                  )}
                  {incoming.value.map((t) => (
                    <ConnectionCardInline
                      key={t.id}
                      thought={t}
                      direction="incoming"
                      onRemove={() => removeIncomingConnection(t.id)}
                    />
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
              <Button
                icon="pi pi-plus"
                severity="secondary"
                size="small"
                text
                onClick={handleAdd}
              />
            </div>
          </>
        ) : (
          <div class={emptyActionClass} onClick={handleAdd}>
            <i class={`pi pi-plus ${emptyIconClass}`} />
          </div>
        )}
      </div>
    );
  },
});
