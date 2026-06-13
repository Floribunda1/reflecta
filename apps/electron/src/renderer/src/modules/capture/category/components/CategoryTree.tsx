import { useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Button } from "@renderer/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { BookOpen, ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import type { CategoryTreeNode } from "@shared/category";
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
  Item: typeof ContextMenuItem | typeof DropdownMenuItem;
  Separator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator;
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
  selectedId,
  expandedKeys,
  onToggle,
  onSelect,
  actions,
}: {
  node: CategoryTreeNode;
  selectedId: string;
  expandedKeys: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  actions: CategoryNodeActions;
}) {
  const expanded = !!expandedKeys[node.id];
  const selected = selectedId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={[
          "group flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm transition-colors",
          selected
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        ].join(" ")}
      >
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => hasChildren && onToggle(node.id)}
          aria-label={expanded ? "折叠分类" : "展开分类"}
        >
          {hasChildren ? expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
        </Button>
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => onSelect(node.id)}
              >
                {node.name}
              </button>
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="invisible shrink-0 group-hover:visible"
                aria-label="分类操作"
              >
                <MoreHorizontal size={15} />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <CategoryMenuItems
              node={node}
              actions={actions}
              Item={DropdownMenuItem}
              Separator={DropdownMenuSeparator}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasChildren && expanded && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-1.5">
          {node.children.map((child) => (
            <CategoryNode
              key={child.id}
              node={child}
              selectedId={selectedId}
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
      { title: "新建领域", widthClassName: "max-w-[420px]" },
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
      { title: "编辑领域", widthClassName: "max-w-[420px]" },
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
    <aside className="flex h-full w-[220px] shrink-0 flex-col gap-0 border-r border-border/60 bg-sidebar px-3">
      <div className="flex shrink-0 items-center justify-between pb-2 pt-4 pl-2">
        <span className="pl-0.5 text-sm font-medium text-sidebar-foreground/70">领域</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="新建领域"
          onClick={() => openCreateModal()}
        >
          <Plus size={16} />
        </Button>
      </div>

      <div className="capture-scroll flex-1 overflow-y-auto py-1">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={[
              "w-full justify-start rounded-md text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              selectedCategoryId === "all"
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "",
            ].join(" ")}
            onClick={() => onSelect("all")}
          >
            <BookOpen size={15} />
            <span className="min-w-0 flex-1 truncate">全部领域</span>
          </Button>

          {categories.map((node) => (
            <CategoryNode
              key={node.id}
              node={node}
              selectedId={selectedCategoryId}
              expandedKeys={expandedCategoryKeys}
              onToggle={onToggle}
              onSelect={onSelect}
              actions={actions}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
