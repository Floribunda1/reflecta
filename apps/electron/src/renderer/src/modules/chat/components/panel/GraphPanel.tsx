import { useChatPageContext } from "../../context";

export function GraphPanel() {
  const ctx = useChatPageContext();
  return (
    <div className="flex h-full flex-col p-4">
      <div className="text-sm font-medium text-foreground">局部引用图谱</div>
      <div className="mt-2 text-xs text-muted-foreground">
        MVP 占位：展示当前对话已引用的 thought。完整子图视图后续接入 Contemplate graph。
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {ctx.conversationReferences.map((thought) => (
          <div
            key={thought.id}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground"
          >
            {thought.title || thought.id}
          </div>
        ))}
      </div>
      {ctx.conversationReferences.length === 0 && (
        <div className="mt-6 text-sm text-muted-foreground">引用 thought 后将在此显示局部节点</div>
      )}
    </div>
  );
}
