import { MouseEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { BookOpen, ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import type { CategoryTreeNode } from "@shared/category";
import { useCategoryContext } from "../context";
import { useCapturePageContext } from "../../context";
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

function CategoryNode({
  node,
  selectedId,
  expandedKeys,
  onToggle,
  onSelect,
  onMenu,
}: {
  node: CategoryTreeNode;
  selectedId: string;
  expandedKeys: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onMenu: (event: Pick<MouseEvent, "clientX" | "clientY">, node: CategoryTreeNode) => void;
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
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left"
          onClick={() => onSelect(node.id)}
          onContextMenu={(event) => {
            event.preventDefault();
            onMenu(event, node);
          }}
        >
          {node.name}
        </button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="invisible shrink-0 group-hover:visible"
          onClick={(event) => onMenu(event, node)}
          aria-label="分类操作"
        >
          <MoreHorizontal size={15} />
        </Button>
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
              onMenu={onMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree() {
  const { categories, createCategory, updateCategory, deleteCategory } = useCategoryContext();
  const capture = useCapturePageContext();
  const { openModal, closeModal, confirm } = useModal();
  const [menuState, setMenuState] = useState<{
    x: number;
    y: number;
    node: CategoryTreeNode;
  } | null>(null);

  useEffect(() => {
    if (!capture.selectedCategoryId || capture.selectedCategoryId === "all") return;
    const ancestors = getAncestorKeys(categories, capture.selectedCategoryId);
    if (!ancestors) return;
    capture.setExpandedCategoryKeys({
      ...capture.expandedCategoryKeys,
      ...Object.fromEntries(ancestors.map((key) => [key, true])),
    });
  }, [categories, capture.selectedCategoryId]);

  useEffect(() => {
    const validKeys = new Set(getAllKeys(categories));
    const next = Object.fromEntries(
      Object.entries(capture.expandedCategoryKeys).filter(([key]) => validKeys.has(key)),
    );
    if (Object.keys(next).length !== Object.keys(capture.expandedCategoryKeys).length) {
      capture.setExpandedCategoryKeys(next);
    }
  }, [categories]);

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
    capture.setSelectedCategoryId(id);
    capture.setSelectedThoughtId(null);
  };

  const onToggle = (id: string) => {
    capture.setExpandedCategoryKeys({
      ...capture.expandedCategoryKeys,
      [id]: !capture.expandedCategoryKeys[id],
    });
  };

  const onMenu = (event: Pick<MouseEvent, "clientX" | "clientY">, node: CategoryTreeNode) => {
    setMenuState({ x: event.clientX, y: event.clientY, node });
  };

  const menu = useMemo(() => {
    if (!menuState) return null;
    const node = menuState.node;
    const deletedCategoryIds = new Set([node.id, ...getAllKeys(node.children)]);
    return (
      <div
        className="fixed z-50 min-w-36 rounded-lg border border-border bg-popover p-1 text-sm shadow-xl"
        style={{ left: menuState.x, top: menuState.y }}
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            setMenuState(null);
            openCreateModal(node.id);
          }}
        >
          新建子领域
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            setMenuState(null);
            openEditModal(node);
          }}
        >
          编辑领域
        </Button>
        <div className="my-1 h-px bg-muted" />
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="w-full justify-start"
          onClick={() => {
            setMenuState(null);
            confirm({
              title: "删除领域",
              message: `确定要删除领域 "${node.name}" 吗？此操作不可撤销。`,
              acceptLabel: "删除",
              danger: true,
              onAccept: async () => {
                await deleteCategory(node.id);
                if (deletedCategoryIds.has(capture.selectedCategoryId)) {
                  capture.setSelectedCategoryId("all");
                  capture.setSelectedThoughtId(null);
                }
              },
            });
          }}
        >
          删除
        </Button>
      </div>
    );
  }, [menuState, categories]);

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
              capture.selectedCategoryId === "all"
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
              selectedId={capture.selectedCategoryId}
              expandedKeys={capture.expandedCategoryKeys}
              onToggle={onToggle}
              onSelect={onSelect}
              onMenu={onMenu}
            />
          ))}
        </div>
      </div>
      {menu}
    </aside>
  );
}
