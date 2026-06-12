import { Badge } from "@renderer/components/ui/badge";
import { Textarea } from "@renderer/components/ui/textarea";
import { Send, StopCircle, X } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { KeyboardEvent } from "react";
import { useChatPageContext } from "../context";

export function ChatInput() {
  const ctx = useChatPageContext();

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (ctx.canSend) void ctx.sendMessage();
    }
  };

  return (
    <div className="border-t border-border bg-background px-6 py-4">
      <div className="mx-auto max-w-3xl">
        {ctx.draftReferences.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {ctx.draftReferences.map((thought) => (
              <Badge key={thought.id} variant="secondary">
                @{thought.title || "无标题"}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="移除引用"
                  onClick={() => ctx.removeDraftReference(thought.id)}
                >
                  <X size={12} />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={ctx.draftText}
            onChange={(event) => ctx.setDraftText(event.target.value)}
            rows={3}
            placeholder="输入消息... 使用右侧面板 @ 引用 thought"
            disabled={!ctx.activeConversationId}
            onKeyDown={handleKeyDown}
            className="min-h-20 flex-1 resize-none"
          />
          {ctx.isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              aria-label="停止"
              onClick={() => void ctx.cancelStream()}
            >
              <StopCircle size={18} />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="default"
              aria-label="发送"
              disabled={!ctx.canSend}
              onClick={() => void ctx.sendMessage()}
            >
              <Send size={18} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
