import { Badge } from "@renderer/components/ui/badge";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@renderer/components/ui/alert";
import { Button } from "@renderer/components/ui/button";
import {
  CheckCircle,
  ExternalLink,
  Folder,
  FolderOpen,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { ipcClient } from "@renderer/utils/ipc";
import type { OrphanAssetInfo } from "@shared/asset";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

export function StorageSection() {
  const { confirm } = useModal();
  const [contentStorageRoot, setContentStorageRoot] = useState("");
  const [isCustomContentStorageRoot, setIsCustomContentStorageRoot] = useState(false);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanCleaning, setOrphanCleaning] = useState(false);
  const [orphans, setOrphans] = useState<OrphanAssetInfo[] | null>(null);

  useEffect(() => {
    void ipcClient.config.getConfig().then((config) => {
      setContentStorageRoot(config.contentStorageRoot);
      setIsCustomContentStorageRoot(config.isCustomContentStorageRoot);
    });
  }, []);

  const handlePickDirectory = async () => {
    const picked = await ipcClient.config.openDirectoryPicker();
    if (!picked) return;
    setLoading(true);
    try {
      await ipcClient.config.setContentStorageRoot(picked);
      setContentStorageRoot(picked);
      setIsCustomContentStorageRoot(true);
      setPendingRestart(true);
    } catch (error) {
      toast.error("更新数据目录失败", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    setLoading(true);
    try {
      await ipcClient.config.setContentStorageRoot("");
      const config = await ipcClient.config.getConfig();
      setContentStorageRoot(config.contentStorageRoot);
      setIsCustomContentStorageRoot(config.isCustomContentStorageRoot);
      setPendingRestart(true);
    } catch (error) {
      toast.error("重置数据目录失败", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleScanOrphans = async () => {
    setOrphanLoading(true);
    try {
      setOrphans(await ipcClient.asset.scanOrphanAssets());
    } catch (error) {
      toast.error("扫描失败", { description: errorMessage(error) });
    } finally {
      setOrphanLoading(false);
    }
  };

  const handleCleanOrphans = () => {
    if (!orphans?.length) return;
    const count = orphans.length;
    const totalSize = formatSize(orphans.reduce((sum, orphan) => sum + orphan.size, 0));
    confirm({
      title: "清除无效文件",
      message: `将永久删除 ${count} 个无效媒体文件（共 ${totalSize}），无法恢复。确定继续吗？`,
      acceptLabel: "确认清除",
      danger: true,
      onAccept: async () => {
        setOrphanCleaning(true);
        try {
          await ipcClient.asset.cleanOrphanAssets(orphans.map((orphan) => orphan.filename));
          setOrphans([]);
          toast.success("已清除无效媒体文件", { description: `${count} 个文件，${totalSize}` });
        } catch (error) {
          toast.error("清除失败", { description: errorMessage(error) });
        } finally {
          setOrphanCleaning(false);
        }
      },
    });
  };

  const openOrphanAsset = async (filename: string) => {
    try {
      await ipcClient.asset.openAsset(filename);
    } catch (error) {
      toast.error("打开文件失败", { description: errorMessage(error) });
    }
  };

  const revealOrphanAsset = async (filename: string) => {
    try {
      await ipcClient.asset.revealAsset(filename);
      toast.success("已在 Finder 中显示");
    } catch (error) {
      toast.error("显示文件失败", { description: errorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-base font-medium text-foreground">存储</h3>
        <p className="mt-1 text-sm text-muted-foreground">数据文件、媒体资源和本地维护操作。</p>
      </div>

      <section className="border-t border-border/70 pt-5">
        <div>
          <h4 className="text-sm font-medium text-foreground">数据目录</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            目录内保存知识库数据库和媒体资源。修改后需要重启应用生效，现有数据不会自动迁移。
          </p>
        </div>
        <div className="mt-3 min-w-0 space-y-3">
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
            <Folder size={15} className="shrink-0 text-muted-foreground" />
            <span
              className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
              title={contentStorageRoot}
            >
              {contentStorageRoot}
            </span>
            {isCustomContentStorageRoot && <Badge variant="secondary">自定义</Badge>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={loading}
              size="sm"
              variant="outline"
              onClick={() => void handlePickDirectory()}
            >
              <FolderOpen size={15} /> 更改目录
            </Button>
            {isCustomContentStorageRoot && (
              <Button
                type="button"
                disabled={loading}
                size="sm"
                variant="outline"
                onClick={() => void handleResetToDefault()}
              >
                <RotateCcw size={15} /> 重置为默认
              </Button>
            )}
          </div>
        </div>
      </section>

      {pendingRestart && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>需要重启</AlertTitle>
          <AlertDescription>数据目录已更新，重启应用后生效。</AlertDescription>
          <AlertAction>
            <Button type="button" size="sm" onClick={() => void ipcClient.config.restartApp()}>
              立即重启
            </Button>
          </AlertAction>
        </Alert>
      )}

      <section className="border-t border-border/70 pt-5">
        <div>
          <h4 className="text-sm font-medium text-foreground">无效媒体文件</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            找出未被引用的孤立媒体文件并清除。
          </p>
        </div>
        <div className="mt-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={orphanLoading}
              size="sm"
              variant="outline"
              onClick={() => void handleScanOrphans()}
            >
              <Search size={15} /> 扫描
            </Button>
            {orphans !== null && orphans.length > 0 && (
              <Button
                type="button"
                disabled={orphanCleaning}
                size="sm"
                variant="destructive"
                onClick={handleCleanOrphans}
              >
                <Trash2 size={15} /> 清除 {orphans.length} 个文件
              </Button>
            )}
          </div>

          {orphans !== null && (
            <div className="mt-3">
              {orphans.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle size={14} className="text-emerald-600" /> 未发现无效文件
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    发现 {orphans.length} 个无效文件，共占用{" "}
                    {formatSize(orphans.reduce((s, o) => s + o.size, 0))}。
                  </p>
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-border/70 p-1">
                    {orphans.map((orphan) => (
                      <div
                        key={orphan.filename}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-muted/60"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                          {orphan.filename}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatSize(orphan.size)}
                        </span>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          aria-label="打开文件"
                          onClick={() => void openOrphanAsset(orphan.filename)}
                        >
                          <ExternalLink size={13} />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          aria-label="在 Finder 中显示"
                          onClick={() => void revealOrphanAsset(orphan.filename)}
                        >
                          <FolderOpen size={13} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
