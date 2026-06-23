import { GitBranch } from "lucide-react";
import { UnderstandingDetail } from "@renderer/modules/capture/understanding-detail";
import { useContemplatePageContext } from "./context";

export function NodeDetail() {
  const ctx = useContemplatePageContext();

  return (
    <div className="flex h-full w-full flex-col border-l border-border bg-background">
      {ctx.selectedUnderstandingId ? (
        <UnderstandingDetail
          understandingId={ctx.selectedUnderstandingId}
          onDeleted={() => ctx.setSelectedUnderstandingId(null)}
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
