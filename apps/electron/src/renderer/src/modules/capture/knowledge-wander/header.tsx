import { Columns3, Share2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@renderer/components/ui/toggle-group";
import type { KnowledgeWanderView } from "../store";

export function KnowledgeWanderHeader({
  scopeTitle,
  count,
  view,
  onViewChange,
}: {
  scopeTitle: string;
  count: number;
  view: KnowledgeWanderView;
  onViewChange: (view: KnowledgeWanderView) => void;
}) {
  return (
    <header
      data-testid="knowledge-wander-header"
      className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{scopeTitle}</div>
        <div className="text-xs text-muted-foreground">{count} 条理解</div>
      </div>

      <ToggleGroup
        multiple={false}
        value={[view]}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="知识漫步视图"
        onValueChange={(values) => {
          const nextView = values[0] as KnowledgeWanderView | undefined;
          if (nextView) onViewChange(nextView);
        }}
      >
        <ToggleGroupItem value="waterfall" aria-label="瀑布流">
          <Columns3 size={14} />
          瀑布流
        </ToggleGroupItem>
        <ToggleGroupItem value="graph" aria-label="图谱">
          <Share2 size={14} />
          图谱
        </ToggleGroupItem>
      </ToggleGroup>
    </header>
  );
}
