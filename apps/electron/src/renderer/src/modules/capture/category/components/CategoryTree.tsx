import { useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { CategoryTreeNode } from "@shared/category";
import { cn } from "@renderer/lib/utils";
import { useCategoryContext } from "../context";
import {
  expandedCategoryKeysAtom,
  selectCategoryAtom,
  selectedCategoryIdAtom,
  selectedThoughtIdAtom,
} from "../../state";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { CategoryModalContent } from "./CreateCategoryModal";

function getAllKeys(nodes: CategoryTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...getAllKeys(node.children)]);
}

function getAncestorKeys(nodes: CategoryTreeNode[], targetKey: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetKey) return [];
    const ancestors = getAncestorKeys(node.children, targetKey);
    if (ancestors !== null) return [node.id, ...ancestors];
  }
  return null;
}

type CategoryNodeActions = {
  onCreateChild: (node: CategoryTreeNode) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
};

function CategoryMenuItems({
  node,
  actions,
  Item,
  Separator,
}: {
  node: CategoryTreeNode;
  actions: CategoryNodeActions;
  Item: typeof ContextMenuItem;
  Separator: typeof ContextMenuSeparator;
}) {
  return (
    <>
      <Item onClick={() => actions.onCreateChild(node)}>新建子领域</Item>
      <Item onClick={() => actions.onEdit(node)}>编辑领域</Item>
      <Separator />
      <Item variant="destructive" onClick={() => actions.onDelete(node)}>
        删除
      </Item>
    </>
  );
}

function CategoryNode({
  node,
  level = 0,
  selectedCategoryId,
  expandedKeys,
  onToggle,
  onSelect,
  actions,
}: {
  node: CategoryTreeNode;
  level?: number;
  selectedCategoryId: string;
  expandedKeys: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  actions: CategoryNodeActions;
}) {
  const expanded = !!expandedKeys[node.id];
  const hasChildren = node.children.length > 0;
  const selected = selectedCategoryId === node.id;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 w-full min-w-0 justify-start gap-2 rounded-lg px-2 text-left font-normal text-foreground/85 hover:bg-accent/70 hover:text-accent-foreground",
                selected &&
                  "bg-card/90 text-foreground shadow-sm ring-1 ring-border/80 hover:bg-card/90",
              )}
              style={{ paddingLeft: `calc(0.5rem + ${level} * 0.875rem)` }}
              onClick={() => {
                onSelect(node.id);
                if (hasChildren) onToggle(node.id);
              }}
              aria-expanded={hasChildren ? expanded : undefined}
            >
              {hasChildren ? (
                expanded ? (
                  <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0 truncate">{node.name}</span>
            </Button>
          }
        />
        <ContextMenuContent>
          <CategoryMenuItems
            node={node}
            actions={actions}
            Item={ContextMenuItem}
            Separator={ContextMenuSeparator}
          />
        </ContextMenuContent>
      </ContextMenu>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <CategoryNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedCategoryId={selectedCategoryId}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
              onSelect={onSelect}
              actions={actions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree() {
  const { categories, createCategory, updateCategory, deleteCategory } = useCategoryContext();
  const selectedCategoryId = useAtomValue(selectedCategoryIdAtom);
  const selectCategory = useSetAtom(selectCategoryAtom);
  const setSelectedCategoryId = useSetAtom(selectedCategoryIdAtom);
  const setSelectedThoughtId = useSetAtom(selectedThoughtIdAtom);
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useAtom(expandedCategoryKeysAtom);
  const { openModal, closeModal, confirm } = useModal();

  useEffect(() => {
    if (!selectedCategoryId || selectedCategoryId === "all") return;
    const ancestors = getAncestorKeys(categories, selectedCategoryId);
    if (!ancestors) return;
    setExpandedCategoryKeys((prev) => ({
      ...prev,
      ...Object.fromEntries(ancestors.map((key) => [key, true])),
    }));
  }, [categories, selectedCategoryId, setExpandedCategoryKeys]);

  useEffect(() => {
    const validKeys = new Set(getAllKeys(categories));
    setExpandedCategoryKeys((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([key]) => validKeys.has(key)));
      if (Object.keys(next).length === Object.keys(prev).length) return prev;
      return next;
    });
  }, [categories, setExpandedCategoryKeys]);

  const openCreateModal = (initialParentId?: string | null) => {
    openModal(
      <CategoryModalContent
        data={{
          initialParentId,
          categories,
          onConfirm: createCategory,
          onClose: closeModal,
        }}
      />,
      { title: "新建领域" },
    );
  };

  const openEditModal = (node: CategoryTreeNode) => {
    openModal(
      <CategoryModalContent
        data={{
          editCategory: { id: node.id, name: node.name, parentId: node.parentId },
          categories,
          onConfirm: (params) => updateCategory(node.id, params),
          onClose: closeModal,
        }}
      />,
      { title: "编辑领域" },
    );
  };

  const onSelect = (id: string) => {
    selectCategory(id);
  };

  const onToggle = (id: string) => {
    setExpandedCategoryKeys((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDelete = (node: CategoryTreeNode) => {
    const deletedCategoryIds = new Set([node.id, ...getAllKeys(node.children)]);
    confirm({
      title: "删除领域",
      message: `确定要删除领域 "${node.name}" 吗？此操作不可撤销。`,
      acceptLabel: "删除",
      danger: true,
      onAccept: async () => {
        await deleteCategory(node.id);
        if (deletedCategoryIds.has(selectedCategoryId)) {
          setSelectedCategoryId("all");
          setSelectedThoughtId(null);
        }
      },
    });
  };

  const actions: CategoryNodeActions = {
    onCreateChild: (node) => openCreateModal(node.id),
    onEdit: openEditModal,
    onDelete: handleDelete,
  };

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-4 pt-10 pb-4">
      <div className="flex h-9 items-center justify-between gap-2">
        <span className="text-sm font-medium">领域</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-8"
          aria-label="新建领域"
          onClick={() => openCreateModal()}
        >
          <Plus size={16} />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 pt-6">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-9 w-full justify-start rounded-lg px-2 text-left font-normal text-foreground/85 hover:bg-accent/70 hover:text-accent-foreground",
              selectedCategoryId === "all" &&
                "bg-card/90 text-foreground shadow-sm ring-1 ring-border/80 hover:bg-card/90",
            )}
            onClick={() => onSelect("all")}
          >
            <span>全部领域</span>
          </Button>

          {categories.map((node) => (
            <CategoryNode
              key={node.id}
              node={node}
              selectedCategoryId={selectedCategoryId}
              expandedKeys={expandedCategoryKeys}
              onToggle={onToggle}
              onSelect={onSelect}
              actions={actions}
            />
          ))}

          {categories.length === 0 && (
            <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">
              还没有领域。新建一个领域后，理解会在这里形成长期语境。
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
