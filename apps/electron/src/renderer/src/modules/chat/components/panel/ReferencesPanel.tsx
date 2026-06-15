import { Button } from "@renderer/components/ui/button";
import { AtSign } from "lucide-react";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";
import { useChatPageContext } from "../../context";

export function ReferencesPanel() {
  const ctx = useChatPageContext();

  return (
    <div className="h-full overflow-y-auto p-3">
      {ctx.conversationReferences.length === 0 && (
        <div className="text-sm text-muted-foreground">当前对话还没有引用任何 thought</div>
      )}
      {ctx.conversationReferences.map((thought) => (
        <div key={thought.id} className="mb-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-medium text-foreground">
              {thought.title || "无标题"}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void ctx.addReference(thought.id)}
            >
              <AtSign size={13} /> 再次引用
            </Button>
          </div>
          {thought.body && (
            <div className="mt-2 text-xs text-muted-foreground">
              <SimpleMarkdownPreview content={thought.body} lineClamp={3} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
