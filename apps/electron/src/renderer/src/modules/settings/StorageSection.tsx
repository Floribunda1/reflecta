import { Badge } from "@renderer/components/ui/badge";
import { useEffect, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import {
  CheckCircle,
  ExternalLink,
  Folder,
  FolderOpen,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { ipcClient } from "@renderer/utils/ipc";
import type { OrphanAssetInfo } from "@shared/asset";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function StorageSection() {
  const { confirm } = useModal();
  const [storagePath, setStoragePath] = useState("");
  const [isCustomPath, setIsCustomPath] = useState(false);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanCleaning, setOrphanCleaning] = useState(false);
  const [orphans, setOrphans] = useState<OrphanAssetInfo[] | null>(null);

  useEffect(() => {
    void ipcClient.config.getConfig().then((config) => {
      setStoragePath(config.storagePath);
      setIsCustomPath(config.isCustomPath);
    });
  }, []);

  const handlePickDirectory = async () => {
    const picked = await ipcClient.config.openDirectoryPicker();
    if (!picked) return;
    setLoading(true);
    try {
      await ipcClient.config.setStoragePath(picked);
      setStoragePath(picked);
      setIsCustomPath(true);
      setPendingRestart(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    setLoading(true);
    try {
      await ipcClient.config.setStoragePath("");
      const config = await ipcClient.config.getConfig();
      setStoragePath(config.storagePath);
      setIsCustomPath(false);
      setPendingRestart(true);
    } finally {
      setLoading(false);
    }
  };

  const handleScanOrphans = async () => {
    setOrphanLoading(true);
    try {
      setOrphans(await ipcClient.asset.scanOrphanAssets());
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
        } finally {
          setOrphanCleaning(false);
        }
      },
    });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold leading-none text-foreground">存储</h3>
        <p className="mt-2 text-sm text-muted-foreground">数据文件、媒体资源和本地维护操作。</p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-medium text-foreground">数据存储路径</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            修改后需要重启应用生效，现有数据不会自动迁移。
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2.5">
          <Folder size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-foreground">
            {storagePath}
          </span>
          {isCustomPath && <Badge variant="secondary">自定义</Badge>}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            disabled={loading}
            size="sm"
            variant="outline"
            onClick={() => void handlePickDirectory()}
          >
            <FolderOpen size={15} /> 更改目录
          </Button>
          {isCustomPath && (
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
      </section>

      {pendingRestart && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>存储路径已更新，需要重启应用后生效。</span>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => void ipcClient.config.restartApp()}
          >
            立即重启
          </Button>
        </div>
      )}

      <section className="border-t border-border pt-5">
        <h4 className="text-sm font-medium text-foreground">无效媒体文件</h4>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          找出未被引用的孤立媒体文件并清除。
        </p>
        <div className="mt-3 flex items-center gap-2">
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
              <p className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle size={14} /> 未发现无效文件
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="mb-1 text-xs text-muted-foreground">
                  发现 {orphans.length} 个无效文件，共占用{" "}
                  {formatSize(orphans.reduce((s, o) => s + o.size, 0))}：
                </p>
                <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                  {orphans.map((orphan) => (
                    <div
                      key={orphan.filename}
                      className="flex items-center gap-2 rounded bg-muted px-2 py-1 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                        {orphan.filename}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatSize(orphan.size)}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="打开文件"
                        onClick={() => void ipcClient.asset.openAsset(orphan.filename)}
                      >
                        <ExternalLink size={13} />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="在 Finder 中显示"
                        onClick={() => void ipcClient.asset.revealAsset(orphan.filename)}
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
      </section>
    </div>
  );
}
