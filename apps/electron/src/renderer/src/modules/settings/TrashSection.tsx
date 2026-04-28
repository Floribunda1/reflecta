import { defineComponent, ref, onMounted } from "vue";
import Button from "primevue/button";
import { ipcClient } from "@renderer/utils/ipc";
import type { TrashedThoughtDTO } from "@shared/trash";
import type { TrashedContextDTO } from "@shared/trash";
import { useConfirm } from "primevue/useconfirm";
import { useQueryClient } from "@tanstack/vue-query";

export const TrashSection = defineComponent({
  name: "TrashSection",
  setup() {
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const thoughts = ref<TrashedThoughtDTO[]>([]);
    const contexts = ref<TrashedContextDTO[]>([]);
    const loading = ref(false);

    const refresh = async () => {
      loading.value = true;
      try {
        const [t, c] = await Promise.all([
          ipcClient.trash.listTrashedThoughts(),
          ipcClient.context.listTrashedContexts(),
        ]);
        thoughts.value = t;
        contexts.value = c;
      } finally {
        loading.value = false;
      }
    };

    onMounted(refresh);

    const handleRestoreThought = async (id: string) => {
      await ipcClient.trash.restoreThought(id);
      queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false });
      await refresh();
    };

    const handleDeleteThoughtForever = (id: string) => {
      confirm.require({
        message: "该想法将被永久删除，无法恢复。确定继续吗？",
        header: "永久删除",
        icon: "pi pi-exclamation-triangle",
        rejectProps: { label: "取消", severity: "secondary", outlined: true },
        acceptProps: { label: "永久删除", severity: "danger" },
        accept: async () => {
          await ipcClient.trash.permanentlyDeleteThought(id);
          queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false });
          await refresh();
        },
      });
    };

    const handleRestoreContext = async (id: string) => {
      await ipcClient.context.restoreContext(id);
      queryClient.invalidateQueries({ queryKey: ["thought.getThoughtById"], exact: false });
      await refresh();
    };

    const handleDeleteContextForever = (id: string) => {
      confirm.require({
        message: "该来源将被永久删除，无法恢复。确定继续吗？",
        header: "永久删除",
        icon: "pi pi-exclamation-triangle",
        rejectProps: { label: "取消", severity: "secondary", outlined: true },
        acceptProps: { label: "永久删除", severity: "danger" },
        accept: async () => {
          await ipcClient.context.permanentlyDeleteContext(id);
          await refresh();
        },
      });
    };

    const handleEmptyTrash = () => {
      const total = thoughts.value.length + contexts.value.length;
      if (total === 0) return;
      confirm.require({
        message: `将永久删除 ${total} 项内容，无法恢复。确定清空吗？`,
        header: "清空回收站",
        icon: "pi pi-exclamation-triangle",
        rejectProps: { label: "取消", severity: "secondary", outlined: true },
        acceptProps: { label: "全部清空", severity: "danger" },
        accept: async () => {
          await Promise.all([
            ...thoughts.value.map((t) => ipcClient.trash.permanentlyDeleteThought(t.id)),
            ...contexts.value.map((c) => ipcClient.context.permanentlyDeleteContext(c.id)),
          ]);
          queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false });
          queryClient.invalidateQueries({ queryKey: ["thought.getThoughtById"], exact: false });
          await refresh();
        },
      });
    };

    const formatDate = (iso: string) => {
      return new Date(iso).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    };

    const truncate = (text: string, max = 60) =>
      text.length > max ? text.slice(0, max) + "…" : text;

    return () => {
      const totalCount = thoughts.value.length + contexts.value.length;

      return (
        <div class="mx-auto flex max-w-2xl flex-col gap-6">
          <div class="border-b border-surface-100 pb-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-lg font-semibold leading-none text-color">回收站</h3>
                <p class="mt-2 text-sm text-muted-color">
                  被删除的 Thought 与 Context 会暂存在这里。
                </p>
              </div>
              {totalCount > 0 && (
                <Button
                  size="small"
                  severity="danger"
                  outlined
                  label="清空回收站"
                  icon="pi pi-trash"
                  onClick={handleEmptyTrash}
                />
              )}
            </div>
          </div>

          {loading.value ? (
            <div class="flex items-center justify-center py-8">
              <i class="pi pi-spin pi-spinner text-muted-color text-xl" />
            </div>
          ) : totalCount === 0 ? (
            <div class="flex flex-col items-center justify-center gap-2 py-10">
              <i
                class="pi pi-trash text-2xl"
                style="color: var(--p-text-muted-color); opacity: 0.35"
              />
              <span class="text-sm text-muted-color">回收站为空</span>
            </div>
          ) : (
            <div class="flex flex-col gap-4">
              {thoughts.value.length > 0 && (
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-1.5">
                    <i class="pi pi-lightbulb text-xs text-muted-color" />
                    <span class="text-xs font-medium text-muted-color uppercase tracking-wide">
                      想法 ({thoughts.value.length})
                    </span>
                  </div>
                  {thoughts.value.map((t) => (
                    <div
                      key={t.id}
                      class="group flex items-center gap-3 rounded-lg border border-surface-200/60 bg-surface-0 px-3 py-2.5 transition-colors hover:bg-surface-50"
                    >
                      <div class="flex-1 min-w-0">
                        <div class="text-sm text-color truncate">
                          {t.title || truncate(t.body) || (
                            <span class="text-muted-color italic">（无内容）</span>
                          )}
                        </div>
                        <div class="text-xs text-muted-color mt-0.5">
                          删除于 {formatDate(t.deletedAt)}
                        </div>
                      </div>
                      <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="small"
                          severity="secondary"
                          text
                          icon="pi pi-replay"
                          title="恢复"
                          onClick={() => handleRestoreThought(t.id)}
                        />
                        <Button
                          size="small"
                          severity="danger"
                          text
                          icon="pi pi-times"
                          title="永久删除"
                          onClick={() => handleDeleteThoughtForever(t.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {contexts.value.length > 0 && (
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-1.5">
                    <i class="pi pi-bookmark text-xs text-muted-color" />
                    <span class="text-xs font-medium text-muted-color uppercase tracking-wide">
                      来源 ({contexts.value.length})
                    </span>
                  </div>
                  {contexts.value.map((c) => (
                    <div
                      key={c.id}
                      class="group flex items-center gap-3 rounded-lg border border-surface-200/60 bg-surface-0 px-3 py-2.5 transition-colors hover:bg-surface-50"
                    >
                      <div class="flex-1 min-w-0">
                        <div class="text-sm text-color truncate">
                          {c.sourceName
                            ? `${c.sourceName} — ${truncate(c.content, 40)}`
                            : truncate(c.content)}
                        </div>
                        <div class="text-xs text-muted-color mt-0.5">
                          来自「{c.thoughtTitle || "无标题想法"}」· 删除于 {formatDate(c.deletedAt)}
                        </div>
                      </div>
                      <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="small"
                          severity="secondary"
                          text
                          icon="pi pi-replay"
                          title="恢复"
                          onClick={() => handleRestoreContext(c.id)}
                        />
                        <Button
                          size="small"
                          severity="danger"
                          text
                          icon="pi pi-times"
                          title="永久删除"
                          onClick={() => handleDeleteContextForever(c.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };
  },
});
