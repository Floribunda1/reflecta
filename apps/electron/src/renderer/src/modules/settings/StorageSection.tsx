import { defineComponent, ref, onMounted } from "vue";
import Button from "primevue/button";
import Message from "primevue/message";
import Tag from "primevue/tag";
import { useConfirm } from "primevue/useconfirm";
import { ipcClient } from "@renderer/utils/ipc";
import type { OrphanAssetInfo } from "@shared/asset";

export const StorageSection = defineComponent({
  name: "StorageSection",
  setup() {
    const confirm = useConfirm();
    const storagePath = ref("");
    const isCustomPath = ref(false);
    const pendingRestart = ref(false);
    const loading = ref(false);

    // Orphan assets state
    const orphanLoading = ref(false);
    const orphanCleaning = ref(false);
    const orphans = ref<OrphanAssetInfo[] | null>(null);

    onMounted(async () => {
      const config = await ipcClient.config.getConfig();
      storagePath.value = config.storagePath;
      isCustomPath.value = config.isCustomPath;
    });

    const handlePickDirectory = async () => {
      const picked = await ipcClient.config.openDirectoryPicker();
      if (!picked) return;
      loading.value = true;
      try {
        await ipcClient.config.setStoragePath(picked);
        storagePath.value = picked;
        isCustomPath.value = true;
        pendingRestart.value = true;
      } finally {
        loading.value = false;
      }
    };

    const handleResetToDefault = async () => {
      loading.value = true;
      try {
        await ipcClient.config.setStoragePath("");
        const config = await ipcClient.config.getConfig();
        storagePath.value = config.storagePath;
        isCustomPath.value = false;
        pendingRestart.value = true;
      } finally {
        loading.value = false;
      }
    };

    const handleRestart = async () => {
      await ipcClient.config.restartApp();
    };

    const handleScanOrphans = async () => {
      orphanLoading.value = true;
      try {
        orphans.value = await ipcClient.asset.scanOrphanAssets();
      } finally {
        orphanLoading.value = false;
      }
    };

    const handleCleanOrphans = () => {
      if (!orphans.value || orphans.value.length === 0) return;
      const count = orphans.value.length;
      const totalSize = formatSize(orphans.value.reduce((s, o) => s + o.size, 0));
      confirm.require({
        message: `将永久删除 ${count} 个无效媒体文件（共 ${totalSize}），无法恢复。确定继续吗？`,
        header: "清除无效文件",
        icon: "pi pi-exclamation-triangle",
        rejectProps: { label: "取消", severity: "secondary", outlined: true },
        acceptProps: { label: "确认清除", severity: "danger" },
        accept: async () => {
          orphanCleaning.value = true;
          try {
            await ipcClient.asset.cleanOrphanAssets(orphans.value!.map((o) => o.filename));
            orphans.value = [];
          } finally {
            orphanCleaning.value = false;
          }
        },
      });
    };

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return () => (
      <div class="mx-auto flex max-w-2xl flex-col gap-6">
        <div class="border-b border-surface-100 pb-4">
          <h3 class="text-lg font-semibold leading-none text-color">存储</h3>
          <p class="mt-2 text-sm text-muted-color">数据文件、媒体资源和本地维护操作。</p>
        </div>

        <section class="flex flex-col gap-3">
          <div>
            <h4 class="text-sm font-medium text-color">数据存储路径</h4>
            <p class="mt-1 text-xs leading-5 text-muted-color">
              修改后需要重启应用生效，现有数据不会自动迁移。
            </p>
          </div>
          <div class="flex items-start gap-2 rounded-lg border border-surface-200/70 bg-surface-50/60 px-3 py-2.5">
            <i class="pi pi-folder mt-0.5 shrink-0 text-sm text-muted-color" />
            <span class="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-color">
              {storagePath.value}
            </span>
            {isCustomPath.value && <Tag severity="secondary" value="自定义" class="shrink-0" />}
          </div>

          <div class="flex gap-2">
            <Button
              size="small"
              severity="secondary"
              label="更改目录"
              icon="pi pi-folder-open"
              loading={loading.value}
              onClick={handlePickDirectory}
            />
            {isCustomPath.value && (
              <Button
                size="small"
                severity="secondary"
                label="重置为默认"
                loading={loading.value}
                onClick={handleResetToDefault}
              />
            )}
          </div>
        </section>

        {pendingRestart.value && (
          <Message
            severity="warn"
            closable={false}
            size="small"
            pt={{
              text: { class: "flex items-center justify-between gap-3 w-full" },
            }}
          >
            <span>存储路径已更新，需要重启应用后生效。</span>
            <Button size="small" label="立即重启" severity="warn" onClick={handleRestart} />
          </Message>
        )}

        <section class="border-t border-surface-100 pt-5">
          <h4 class="text-sm font-medium text-color">无效媒体文件</h4>
          <p class="mt-1 text-xs leading-5 text-muted-color">找出未被引用的孤立媒体文件并清除。</p>
          <div class="flex items-center gap-2">
            <Button
              size="small"
              severity="secondary"
              label="扫描"
              icon="pi pi-search"
              loading={orphanLoading.value}
              onClick={handleScanOrphans}
            />
            {orphans.value !== null && orphans.value.length > 0 && (
              <Button
                size="small"
                severity="danger"
                label={`清除 ${orphans.value.length} 个文件`}
                icon="pi pi-trash"
                loading={orphanCleaning.value}
                onClick={handleCleanOrphans}
              />
            )}
          </div>

          {orphans.value !== null && (
            <div class="mt-3">
              {orphans.value.length === 0 ? (
                <p class="text-xs text-green-600 flex items-center gap-1.5">
                  <i class="pi pi-check-circle" />
                  未发现无效文件
                </p>
              ) : (
                <div class="flex flex-col gap-1">
                  <p class="text-xs text-muted-color mb-1">
                    发现 {orphans.value.length} 个无效文件，共占用{" "}
                    {formatSize(orphans.value.reduce((s, o) => s + o.size, 0))}：
                  </p>
                  <div class="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                    {orphans.value.map((o) => (
                      <div
                        key={o.filename}
                        class="flex items-center gap-2 rounded bg-surface-50 px-2 py-1 text-xs"
                      >
                        <span class="min-w-0 flex-1 truncate font-mono text-color">
                          {o.filename}
                        </span>
                        <span class="shrink-0 text-muted-color">{formatSize(o.size)}</span>
                        <button
                          class="shrink-0 text-muted-color hover:text-color transition-colors cursor-pointer"
                          title="打开文件"
                          onClick={() => ipcClient.asset.openAsset(o.filename)}
                        >
                          <i class="pi pi-external-link text-xs" />
                        </button>
                        <button
                          class="shrink-0 text-muted-color hover:text-color transition-colors cursor-pointer"
                          title="在 Finder 中显示"
                          onClick={() => ipcClient.asset.revealAsset(o.filename)}
                        >
                          <i class="pi pi-folder-open text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    );
  },
});
