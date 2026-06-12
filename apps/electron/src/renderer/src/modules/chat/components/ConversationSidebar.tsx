import { Input } from "@renderer/components/ui/input";
import { useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useChatPageContext } from "../context";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";

export function ConversationSidebar() {
  const ctx = useChatPageContext();
  const { confirm } = useModal();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (id: string, title: string) => {
    setRenamingId(id);
    setRenameValue(title);
  };

  const commitRename = async () => {
    if (!renamingId) return;
    const title = renameValue.trim();
    if (title) await ctx.renameConversation(renamingId, title);
    setRenamingId(null);
  };

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-muted">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">对话</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="新建对话"
          disabled={ctx.isStreaming}
          onClick={() => void ctx.createConversation()}
        >
          <Plus size={16} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {ctx.conversationsLoading && ctx.conversations.length === 0 && (
          <div className="px-2 py-4 text-sm text-muted-foreground">加载中...</div>
        )}
        {!ctx.conversationsLoading && ctx.conversations.length === 0 && (
          <div className="px-2 py-4 text-sm text-muted-foreground">暂无对话，点击 + 新建</div>
        )}
        {ctx.conversations.map((conversation) => {
          const active = ctx.activeConversationId === conversation.id;
          const renaming = renamingId === conversation.id;
          return (
            <div
              key={conversation.id}
              className={[
                "group mb-1 rounded-lg border px-3 py-2 transition-colors",
                active
                  ? "border-primary/20 bg-primary/10"
                  : "border-transparent hover:border-border hover:bg-background",
                ctx.isStreaming && !active ? "opacity-50" : "",
              ].join(" ")}
            >
              {renaming ? (
                <Input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="w-full"
                  aria-label="重命名对话"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void commitRename();
                    if (event.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => void commitRename()}
                />
              ) : (
                <button
                  type="button"
                  className="w-full text-left"
                  disabled={ctx.isStreaming && !active}
                  onClick={() => ctx.selectConversation(conversation.id)}
                >
                  <div className="truncate text-sm font-medium text-foreground">
                    {conversation.title}
                  </div>
                  {conversation.lastMessagePreview && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {conversation.lastMessagePreview}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(conversation.updatedAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </div>
                </button>
              )}
              {!renaming && (
                <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="重命名"
                    onClick={() => startRename(conversation.id, conversation.title)}
                  >
                    <Pencil size={13} />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    aria-label="删除对话"
                    disabled={ctx.isStreaming}
                    onClick={() =>
                      confirm({
                        title: "删除对话",
                        message: "确定删除这个对话吗？",
                        acceptLabel: "删除",
                        danger: true,
                        onAccept: () => ctx.deleteConversation(conversation.id),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
