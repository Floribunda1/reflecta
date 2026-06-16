import { GitBranch } from "lucide-react";
import { ThoughtDetail } from "@renderer/modules/capture/thought-detail";
import { useContemplatePageContext } from "./context";

export function NodeDetail() {
  const ctx = useContemplatePageContext();

  return (
    <div className="flex h-full w-full flex-col border-l border-border bg-background">
      {ctx.selectedThoughtId ? (
        <ThoughtDetail
          thoughtId={ctx.selectedThoughtId}
          onDeleted={() => ctx.setSelectedThoughtId(null)}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
          <GitBranch size={40} className="text-muted-foreground opacity-20" />
          <span className="text-center text-sm text-muted-foreground">点击图中节点查看详情</span>
        </div>
      )}
    </div>
  );
}
