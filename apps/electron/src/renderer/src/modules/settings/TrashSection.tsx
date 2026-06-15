import { useEffect, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Lightbulb, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { TrashedThoughtDTO, TrashedContextDTO } from "@shared/trash";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";

export function TrashSection() {
  const { confirm } = useModal();
  const queryClient = useQueryClient();
  const [thoughts, setThoughts] = useState<TrashedThoughtDTO[]>([]);
  const [contexts, setContexts] = useState<TrashedContextDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [trashedThoughts, trashedContexts] = await Promise.all([
        ipcClient.trash.listTrashedThoughts(),
        ipcClient.context.listTrashedContexts(),
      ]);
      setThoughts(trashedThoughts);
      setContexts(trashedContexts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleRestoreThought = async (id: string) => {
    await ipcClient.trash.restoreThought(id);
    queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false });
    await refresh();
  };

  const handleDeleteThoughtForever = (id: string) => {
    confirm({
      title: "永久删除",
      message: "该想法将被永久删除，无法恢复。确定继续吗？",
      acceptLabel: "永久删除",
      danger: true,
      onAccept: async () => {
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
    confirm({
      title: "永久删除",
      message: "该来源将被永久删除，无法恢复。确定继续吗？",
      acceptLabel: "永久删除",
      danger: true,
      onAccept: async () => {
        await ipcClient.context.permanentlyDeleteContext(id);
        await refresh();
      },
    });
  };

  const handleEmptyTrash = () => {
    const total = thoughts.length + contexts.length;
    if (total === 0) return;
    confirm({
      title: "清空回收站",
      message: `将永久删除 ${total} 项内容，无法恢复。确定清空吗？`,
      acceptLabel: "全部清空",
      danger: true,
      onAccept: async () => {
        await Promise.all([
          ...thoughts.map((thought) => ipcClient.trash.permanentlyDeleteThought(thought.id)),
          ...contexts.map((context) => ipcClient.context.permanentlyDeleteContext(context.id)),
        ]);
        queryClient.invalidateQueries({ queryKey: ["thought.listThoughts"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["thought.getThoughtById"], exact: false });
        await refresh();
      },
    });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const truncate = (text: string, max = 60) =>
    text.length > max ? `${text.slice(0, max)}...` : text;
  const totalCount = thoughts.length + contexts.length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-medium text-foreground">回收站</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              被删除的 Thought 与 Context 会暂存在这里。
            </p>
          </div>
          {totalCount > 0 && (
            <Button type="button" size="sm" variant="destructive" onClick={handleEmptyTrash}>
              <Trash2 size={15} /> 清空回收站
            </Button>
          )}
        </div>
      </div>

      <section className="border-t border-border/70 pt-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={22} />
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 py-10">
            <Trash2 size={24} className="text-muted-foreground opacity-50" />
            <span className="text-sm text-muted-foreground">回收站为空</span>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {thoughts.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Lightbulb size={13} />
                  <span>想法 ({thoughts.length})</span>
                </div>
                {thoughts.map((thought) => (
                  <div
                    key={thought.id}
                    className="group flex items-center gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/45"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">
                        {thought.title || truncate(thought.body) || (
                          <span className="italic text-muted-foreground">（无内容）</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        删除于 {formatDate(thought.deletedAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="恢复"
                        onClick={() => void handleRestoreThought(thought.id)}
                      >
                        <RotateCcw size={15} />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="destructive"
                        aria-label="永久删除"
                        onClick={() => handleDeleteThoughtForever(thought.id)}
                      >
                        <X size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contexts.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium text-muted-foreground">
                  来源 ({contexts.length})
                </div>
                {contexts.map((context) => (
                  <div
                    key={context.id}
                    className="group flex items-center gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/45"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">
                        {context.sourceName
                          ? `${context.sourceName} - ${truncate(context.content, 40)}`
                          : truncate(context.content)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        来自「{context.thoughtTitle || "无标题想法"}」 · 删除于{" "}
                        {formatDate(context.deletedAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="恢复"
                        onClick={() => void handleRestoreContext(context.id)}
                      >
                        <RotateCcw size={15} />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="destructive"
                        aria-label="永久删除"
                        onClick={() => handleDeleteContextForever(context.id)}
                      >
                        <X size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
