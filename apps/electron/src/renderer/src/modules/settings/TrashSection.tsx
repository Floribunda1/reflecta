import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@reflecta/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@reflecta/ui/components/item";
import { Lightbulb, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { TrashedUnderstandingDTO, TrashedContextDTO } from "@shared/trash";
import { useModal } from "@reflecta/ui/overlays";

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

export function TrashSection() {
  const { confirm } = useModal();
  const queryClient = useQueryClient();
  const [understandings, setUnderstandings] = useState<TrashedUnderstandingDTO[]>([]);
  const [contexts, setContexts] = useState<TrashedContextDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [trashedUnderstandings, trashedContexts] = await Promise.all([
        ipcClient.trash.listTrashedUnderstandings(),
        ipcClient.context.listTrashedContexts(),
      ]);
      setUnderstandings(trashedUnderstandings);
      setContexts(trashedContexts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleRestoreUnderstanding = async (id: string) => {
    try {
      await ipcClient.trash.restoreUnderstanding(id);
      queryClient.invalidateQueries({
        queryKey: ["understanding.listUnderstandings"],
        exact: false,
      });
      await refresh();
      toast.success("已恢复 Understanding");
    } catch (error) {
      toast.error("恢复失败", { description: errorMessage(error) });
    }
  };

  const handleDeleteUnderstandingForever = (id: string) => {
    confirm({
      title: "永久删除",
      message: "该理解将被永久删除，无法恢复。确定继续吗？",
      acceptLabel: "永久删除",
      danger: true,
      onAccept: async () => {
        try {
          await ipcClient.trash.permanentlyDeleteUnderstanding(id);
          queryClient.invalidateQueries({
            queryKey: ["understanding.listUnderstandings"],
            exact: false,
          });
          await refresh();
          toast.success("已永久删除 Understanding");
        } catch (error) {
          toast.error("永久删除失败", { description: errorMessage(error) });
        }
      },
    });
  };

  const handleRestoreContext = async (id: string) => {
    try {
      await ipcClient.context.restoreContext(id);
      queryClient.invalidateQueries({
        queryKey: ["understanding.getUnderstandingById"],
        exact: false,
      });
      await refresh();
      toast.success("已恢复 Context");
    } catch (error) {
      toast.error("恢复失败", { description: errorMessage(error) });
    }
  };

  const handleDeleteContextForever = (id: string) => {
    confirm({
      title: "永久删除",
      message: "该上下文将被永久删除，无法恢复。确定继续吗？",
      acceptLabel: "永久删除",
      danger: true,
      onAccept: async () => {
        try {
          await ipcClient.context.permanentlyDeleteContext(id);
          await refresh();
          toast.success("已永久删除 Context");
        } catch (error) {
          toast.error("永久删除失败", { description: errorMessage(error) });
        }
      },
    });
  };

  const handleEmptyTrash = () => {
    const total = understandings.length + contexts.length;
    if (total === 0) return;
    confirm({
      title: "清空回收站",
      message: `将永久删除 ${total} 项内容，无法恢复。确定清空吗？`,
      acceptLabel: "全部清空",
      danger: true,
      onAccept: async () => {
        try {
          await Promise.all([
            ...understandings.map((understanding) =>
              ipcClient.trash.permanentlyDeleteUnderstanding(understanding.id),
            ),
            ...contexts.map((context) => ipcClient.context.permanentlyDeleteContext(context.id)),
          ]);
          queryClient.invalidateQueries({
            queryKey: ["understanding.listUnderstandings"],
            exact: false,
          });
          queryClient.invalidateQueries({
            queryKey: ["understanding.getUnderstandingById"],
            exact: false,
          });
          await refresh();
          toast.success("已清空回收站", { description: `${total} 项内容` });
        } catch (error) {
          toast.error("清空回收站失败", { description: errorMessage(error) });
        }
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
  const totalCount = understandings.length + contexts.length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-medium text-foreground">回收站</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              被删除的 Understanding 与 Context 会暂存在这里。
            </p>
          </div>
          {totalCount > 0 && (
            <Button type="button" size="sm" variant="destructive" onClick={handleEmptyTrash}>
              <Trash2 size={15} /> 清空回收站
            </Button>
          )}
        </div>
      </div>

      <section className="section-divider">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={22} />
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-10">
            <Trash2 size={24} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">回收站为空</span>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {understandings.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Lightbulb size={13} />
                  <span>理解 ({understandings.length})</span>
                </div>
                {understandings.map((understanding) => (
                  <Item key={understanding.id} variant="outline" size="xs" className="gap-3">
                    <ItemContent>
                      <ItemTitle>
                        {understanding.title || truncate(understanding.body) || (
                          <span className="italic text-muted-foreground">（无内容）</span>
                        )}
                      </ItemTitle>
                      <ItemDescription>
                        删除于 {formatDate(understanding.deletedAt)}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="gap-1 opacity-0 transition-opacity group-hover/item:opacity-100">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="恢复"
                        onClick={() => void handleRestoreUnderstanding(understanding.id)}
                      >
                        <RotateCcw size={15} />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="destructive"
                        aria-label="永久删除"
                        onClick={() => handleDeleteUnderstandingForever(understanding.id)}
                      >
                        <X size={15} />
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </div>
            )}

            {contexts.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium text-foreground">
                  上下文 ({contexts.length})
                </div>
                {contexts.map((context) => (
                  <Item key={context.id} variant="outline" size="xs" className="gap-3">
                    <ItemContent>
                      <ItemTitle>
                        {context.title
                          ? `${context.title} - ${truncate(context.content, 40)}`
                          : truncate(context.content)}
                      </ItemTitle>
                      <ItemDescription>
                        来自「{context.understandingTitle || "无标题理解"}」 · 删除于{" "}
                        {formatDate(context.deletedAt)}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="gap-1 opacity-0 transition-opacity group-hover/item:opacity-100">
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
                    </ItemActions>
                  </Item>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
