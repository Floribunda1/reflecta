import { useEffect } from "react";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import { ChevronDown, ChevronRight, Layers, Plus } from "lucide-react";
import type { CategoryTreeNode } from "@shared/category";
import { cn } from "@renderer/lib/utils";
import { useCategoryActions } from "../hooks";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { CategoryModalContent } from "./CreateCategoryModal";
import { useCaptureStore } from "../../store";
import { useCaptureCategories } from "../../queries";
import { APP_CHROME_MENU_HIT_AREA_CLASS } from "@renderer/modules/shared/layout/AppChromeMenu";

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
                "w-full min-w-0 justify-start text-left font-normal text-foreground/85 p-1.5 hover:bg-foreground/5 hover:text-foreground",
                selected && "bg-foreground/5 text-foreground font-medium hover:bg-foreground/5",
              )}
              onClick={() => onSelect(node.id)}
            >
              <span
                className="flex min-w-0 flex-1 items-center gap-1"
                style={{ paddingLeft: `calc(${level} * 0.875rem)` }}
              >
                {hasChildren ? (
                  <span
                    className="flex size-6 shrink-0 items-center justify-center text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(node.id);
                    }}
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                ) : (
                  <span className="size-6 shrink-0" />
                )}
                <span className="min-w-0 truncate">{node.name}</span>
              </span>
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

function CategoryRootButton({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn(
        "w-full justify-start text-left font-normal text-foreground/85 p-1.5 hover:bg-foreground/5 hover:text-foreground",
        selected && "bg-foreground/5 text-foreground font-medium hover:bg-foreground/5",
      )}
      onClick={onSelect}
    >
      <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
        <Layers size={14} />
      </span>
      <span className="min-w-0 truncate">全部领域</span>
    </Button>
  );
}

export function CategoryTree() {
  const { categories } = useCaptureCategories();
  const { createCategory, updateCategory, deleteCategory } = useCategoryActions();
  const selectedCategoryId = useCaptureStore((state) => state.selectedCategoryId);
  const expandedCategoryKeys = useCaptureStore((state) => state.expandedCategoryIds);
  const selectCategory = useCaptureStore((state) => state.selectCategory);
  const toggleCategoryExpanded = useCaptureStore((state) => state.toggleCategoryExpanded);
  const reconcileExpandedCategories = useCaptureStore((state) => state.reconcileExpandedCategories);
  const expandCategoryAncestors = useCaptureStore((state) => state.expandCategoryAncestors);
  const resetAfterCategoryDeleted = useCaptureStore((state) => state.resetAfterCategoryDeleted);
  const { openModal, closeModal, confirm } = useModal();

  useEffect(() => {
    if (!selectedCategoryId || selectedCategoryId === "all") return;
    const ancestors = getAncestorKeys(categories, selectedCategoryId);
    if (!ancestors) return;
    expandCategoryAncestors(ancestors);
  }, [categories, selectedCategoryId, expandCategoryAncestors]);

  useEffect(() => {
    const validKeys = new Set(getAllKeys(categories));
    reconcileExpandedCategories(validKeys);
  }, [categories, reconcileExpandedCategories]);

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
    toggleCategoryExpanded(id);
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
        resetAfterCategoryDeleted(deletedCategoryIds);
      },
    });
  };

  const actions: CategoryNodeActions = {
    onCreateChild: (node) => openCreateModal(node.id),
    onEdit: openEditModal,
    onDelete: handleDelete,
  };

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="app-drag-region relative px-5 pt-14 pb-3">
        {/* Electron requires no-drag inside the same drag region to release this hit area. */}
        <div
          data-no-drag
          aria-hidden="true"
          className={`${APP_CHROME_MENU_HIT_AREA_CLASS} pointer-events-none`}
        />
        <div className="flex h-8 items-center justify-between gap-1">
          <div className="min-w-0 truncate text-sm font-medium">领域</div>
          <Button
            data-no-drag
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
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 px-2">
          <CategoryRootButton
            selected={selectedCategoryId === "all"}
            onSelect={() => onSelect("all")}
          />

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
