import { Input } from "@renderer/components/ui/input";
import { KeyboardEvent, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { AtSign, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";
import { useChatPageContext } from "../../context";

export function SearchPanel() {
  const ctx = useChatPageContext();
  const [inputValue, setInputValue] = useState("");

  const searchQuery = useQuery({
    queryKey: ["chat.panel.search", ctx.panelSearchQuery] as const,
    queryFn: () => ipcClient.search.search(ctx.panelSearchQuery),
    enabled: ctx.panelSearchQuery.length > 0,
  });

  const submit = () => ctx.setPanelSearchQuery(inputValue.trim());
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") submit();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-3">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索 Thought 或 Context"
            aria-label="搜索 Thought 或 Context"
            className="min-w-0 flex-1"
          />
          <Button type="button" size="icon" variant="default" aria-label="搜索" onClick={submit}>
            <Search size={16} />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!ctx.panelSearchQuery && (
          <div className="p-4 text-sm text-muted-foreground">输入关键词后搜索</div>
        )}
        {searchQuery.isFetching && (
          <div className="p-4 text-sm text-muted-foreground">搜索中...</div>
        )}
        {searchQuery.data?.thoughts.map((thought) => (
          <div key={thought.id} className="border-b border-border px-3 py-3 hover:bg-muted">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm font-medium text-foreground">
                {thought.title || "无标题"}
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="添加引用"
                onClick={() => void ctx.addReference(thought.id)}
              >
                <AtSign size={14} />
              </Button>
            </div>
            {thought.body && (
              <div className="mt-1 text-xs text-muted-foreground">
                <SimpleMarkdownPreview content={thought.body} lineClamp={2} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
