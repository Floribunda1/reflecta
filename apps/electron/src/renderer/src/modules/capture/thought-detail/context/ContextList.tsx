import { defineComponent, computed } from "vue";
import type { ContextDTO } from "@shared/context";
import { useThoughtDetailContext } from "../context";
import { ContextCardInline } from "./ContextCardInline";
import { useSharedDrawer } from "@renderer/modules/shared/hooks/use-drawer";
import { UpdateContextDrawer } from "./UpdateContextDrawer";
import Button from "primevue/button";

const emptyActionClass =
  "flex cursor-pointer select-none items-center justify-center rounded-md border border-dashed border-[var(--p-content-border-color)] bg-transparent px-3 py-8 transition-colors duration-150 hover:bg-surface-50";
const emptyIconClass = "text-2xl text-muted-color";

export const ContextList = defineComponent({
  name: "ContextList",
  setup() {
    const { thought, createContext, updateContext, deleteContext } = useThoughtDetailContext()!;
    const { openDrawer } = useSharedDrawer();
    const contexts = computed(() => thought.value?.contexts ?? []);

    const handleEdit = (ctx: ContextDTO) => {
      openDrawer(
        {
          position: "right",
          style: { width: "60%", maxWidth: "100vw" },
          header: "修改 Context",
        },
        <UpdateContextDrawer
          context={ctx}
          handleConfirm={async (form) => {
            await updateContext(ctx.id, {
              ...form,
              sourceName: form.sourceName ?? undefined,
            });
          }}
        />,
      );
    };

    const handleDelete = async (id: string) => {
      await deleteContext(id);
    };

    const handleAdd = () => {
      openDrawer(
        {
          position: "right",
          style: { width: "520px", maxWidth: "100vw" },
          header: "新增 Context",
        },
        <UpdateContextDrawer
          handleConfirm={async (form) => {
            await createContext({
              ...form,
              sourceName: form.sourceName ?? undefined,
              thoughtId: thought.value!.id,
            });
          }}
        />,
      );
    };

    return () => (
      <div>
        {contexts.value.length > 0 ? (
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              {contexts.value.map((ctx) => (
                <ContextCardInline
                  key={ctx.id}
                  context={{ ...ctx, sourceName: ctx.sourceName ?? null }}
                  onEdit={() => handleEdit(ctx)}
                  onDelete={() => handleDelete(ctx.id)}
                />
              ))}
            </div>
            <Button icon="pi pi-plus" severity="secondary" size="small" text onClick={handleAdd} />
          </div>
        ) : (
          <div class={emptyActionClass} onClick={handleAdd}>
            <i class={`pi pi-plus ${emptyIconClass}`} />
          </div>
        )}
      </div>
    );
  },
});
