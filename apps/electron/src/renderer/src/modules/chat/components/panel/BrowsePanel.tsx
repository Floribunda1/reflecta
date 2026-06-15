import { Button } from "@renderer/components/ui/button";
import { ChevronDown, ChevronRight, Grid2X2, AtSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CategoryTreeNode } from "@shared/category";
import { ipcClient } from "@renderer/utils/ipc";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";
import { useChatPageContext } from "../../context";
import { useState } from "react";
import { useCaptureCategories } from "@renderer/modules/capture/queries";

function CategoryItem({
  node,
  selectedId,
  onSelect,
}: {
  node: CategoryTreeNode;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className={[
          "flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm",
          selectedId === node.id
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        ].join(" ")}
      >
        <button
          type="button"
          className="h-5 w-5"
          onClick={() => hasChildren && setExpanded((value) => !value)}
        >
          {hasChildren ? expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left"
          onClick={() => onSelect(node.id)}
        >
          {node.name}
        </button>
      </div>
      {hasChildren && expanded && (
        <div className="ml-4">
          {node.children.map((child) => (
            <CategoryItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BrowsePanel() {
  const ctx = useChatPageContext();
  const { categories } = useCaptureCategories();

  const thoughtsQuery = useQuery({
    queryKey: ["chat.browse.thoughts", ctx.selectedCategoryId] as const,
    queryFn: () => {
      if (ctx.selectedCategoryId === "all") return ipcClient.thought.listThoughts();
      return ipcClient.thought.listThoughts({
        categoryIds: [ctx.selectedCategoryId],
        includeDescendants: true,
      });
    },
  });

  const selectedThoughtQuery = useQuery({
    queryKey: ["chat.browse.thought", ctx.selectedThoughtId] as const,
    queryFn: () => ipcClient.thought.getThoughtById(ctx.selectedThoughtId!),
    enabled: !!ctx.selectedThoughtId,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="max-h-52 overflow-auto border-b border-border p-3">
        <Button
          type="button"
          size="sm"
          variant={ctx.selectedCategoryId === "all" ? "default" : "ghost"}
          className="mb-1 w-full justify-start"
          onClick={() => ctx.setSelectedCategoryId("all")}
        >
          <Grid2X2 size={14} /> 全部
        </Button>
        {categories.map((node) => (
          <CategoryItem
            key={node.id}
            node={node}
            selectedId={ctx.selectedCategoryId}
            onSelect={ctx.setSelectedCategoryId}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-b border-border">
        {(thoughtsQuery.data ?? []).map((thought) => (
          <button
            key={thought.id}
            type="button"
            className={[
              "block w-full border-b border-border px-3 py-2 text-left hover:bg-muted",
              ctx.selectedThoughtId === thought.id ? "bg-primary/10" : "",
            ].join(" ")}
            onClick={() => ctx.setSelectedThoughtId(thought.id)}
          >
            <div className="truncate text-sm font-medium text-foreground">
              {thought.title || "无标题"}
            </div>
            <div className="truncate text-xs text-muted-foreground">{thought.type}</div>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedThoughtQuery.data ? (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-foreground">
                {selectedThoughtQuery.data.title || "无标题"}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void ctx.addReference(selectedThoughtQuery.data!.id)}
              >
                <AtSign size={13} /> 引用
              </Button>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <SimpleMarkdownPreview content={selectedThoughtQuery.data.body ?? ""} />
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">选择一条 thought 查看详情</div>
        )}
      </div>
    </div>
  );
}
