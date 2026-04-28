import { defineComponent, ref, computed, watch } from "vue";
import type { CategoryTreeNode, ReorderCategoryItem } from "@shared/category";
import { useCategoryProvide } from "../context";
import Button from "primevue/button";
import Tree from "primevue/tree";
import type { TreeNode as PrimeTreeNode } from "primevue/treenode";
import ContextMenu from "primevue/contextmenu";
import { useConfirm } from "primevue/useconfirm";
import { useCapturePageContext } from "../../context";
import { useDialog } from "primevue/usedialog";
import { CategoryModalContent } from "./CreateCategoryModal";
import { MenuItem } from "primevue/menuitem";

interface TreeNode {
  key: string;
  label: string;
  data: CategoryTreeNode;
  children?: TreeNode[];
}

function getAllKeys(nodes: TreeNode[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    keys.push(node.key);
    if (node.children) keys.push(...getAllKeys(node.children));
  }
  return keys;
}

function getAncestorKeys(nodes: TreeNode[], targetKey: string): string[] | null {
  for (const node of nodes) {
    if (node.key === targetKey) return [];
    if (node.children) {
      const ancestors = getAncestorKeys(node.children, targetKey);
      if (ancestors !== null) {
        return [node.key, ...ancestors];
      }
    }
  }
  return null;
}

function convertToTreeNodes(categories: CategoryTreeNode[]): TreeNode[] {
  return categories.map((cat) => ({
    key: cat.id,
    label: cat.name,
    data: cat,
    children: cat.children.length > 0 ? convertToTreeNodes(cat.children) : undefined,
  }));
}

/** Flatten a PrimeVue tree into reorder items with parentId + sortOrder */
function flattenTreeOrder(nodes: PrimeTreeNode[], parentId: string | null): ReorderCategoryItem[] {
  const items: ReorderCategoryItem[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    items.push({ id: node.key!, parentId, sortOrder: i });
    if (node.children?.length) {
      items.push(...flattenTreeOrder(node.children, node.key!));
    }
  }
  return items;
}

export const CategoryTree = defineComponent({
  name: "CategoryTree",
  setup() {
    const { categories, createCategory, updateCategory, deleteCategory, reorderCategories } =
      useCategoryProvide()!;
    const capture = useCapturePageContext()!;
    const confirm = useConfirm();
    const dialog = useDialog();

    const selectedParentId = ref<string | null>(null);
    const editingCategory = ref<{
      id: string;
      name: string;
      parentId: string | null;
    } | null>(null);

    const treeData = ref<TreeNode[]>([]);

    // Sync from server data → local treeData
    watch(
      () => categories.value,
      (cats) => {
        treeData.value = convertToTreeNodes(cats);
      },
      { immediate: true },
    );

    const expandedKeys = capture.expandedCategoryKeys;

    // Ensure selected category is visible by expanding its ancestors
    watch(
      [() => capture.selectedCategoryId.value, treeData],
      ([selectedId, nodes]) => {
        if (!selectedId || selectedId === "all") return;
        const ancestors = getAncestorKeys(nodes, selectedId);
        if (ancestors) {
          for (const key of ancestors) {
            expandedKeys.value[key] = true;
          }
        }
      },
      { immediate: true },
    );

    // Clean up keys that no longer exist in the tree
    watch(treeData, (nodes) => {
      const validKeys = new Set(getAllKeys(nodes));
      let changed = false;
      for (const key of Object.keys(expandedKeys.value)) {
        if (!validKeys.has(key)) {
          delete expandedKeys.value[key];
          changed = true;
        }
      }
      if (changed) {
        expandedKeys.value = { ...expandedKeys.value };
      }
    });

    const selectedKey = computed({
      get: () => {
        const id = capture.selectedCategoryId.value;
        return id && id !== "all" ? { [id]: true } : { all: true };
      },
      set: (val) => {
        const keys = Object.keys(val);
        if (keys.length > 0) {
          capture.selectedCategoryId.value = keys[0];
          capture.selectedThoughtId.value = null;
        }
      },
    });

    const allNodeData = [{ key: "all", label: "全部" }];

    const allTreePt = {
      nodeToggleButton: { class: "!hidden" },
    };

    const onNodeDrop = () => {
      const items = flattenTreeOrder(treeData.value, null);
      reorderCategories(items);
    };

    const openCreateModal = (initialParentId?: string) => {
      dialog.open(CategoryModalContent, {
        props: {
          header: "新建分类",
          style: { width: "420px" },
          modal: true,
          dismissableMask: true,
        },
        data: {
          initialParentId,
          categories: categories.value,
          onConfirm: createCategory,
        },
      });
    };

    const openEditModal = () => {
      if (!editingCategory.value) return;
      dialog.open(CategoryModalContent, {
        props: {
          header: "编辑分类",
          style: { width: "420px" },
          modal: true,
          dismissableMask: true,
        },
        data: {
          editCategory: editingCategory.value,
          categories: categories.value,
          onConfirm: (params: { name: string; parentId: string | null }) =>
            updateCategory(editingCategory.value!.id, params),
        },
      });
    };

    const cm = ref<InstanceType<typeof ContextMenu>>();
    const contextMenuItems = ref<MenuItem[]>([
      {
        label: "新建子分类",
        icon: "pi pi-plus",
        command: () => {
          if (selectedParentId.value) {
            openCreateModal(selectedParentId.value);
          }
        },
      },
      {
        label: "编辑分类",
        icon: "pi pi-pencil",
        command: () => {
          openEditModal();
        },
      },
      { separator: true },
      {
        label: "删除",
        icon: "pi pi-trash",
        class: "text-red-600",
        command: () => {
          if (editingCategory.value) {
            confirm.require({
              message: `确定要删除分类 "${editingCategory.value.name}" 吗？此操作不可撤销。`,
              header: "删除分类",
              rejectLabel: "取消",
              acceptLabel: "删除",
              acceptClass: "p-button-danger",
              accept: () => deleteCategory(editingCategory.value!.id),
            });
          }
        },
      },
    ]);

    const onNodeContextMenu = (e: MouseEvent, node: TreeNode) => {
      selectedParentId.value = node.key;
      editingCategory.value = {
        id: node.data.id,
        name: node.data.name,
        parentId: node.data.parentId,
      };
      cm.value?.show(e);
    };

    const treePt = computed(() => ({
      nodeContent: (options: any) => {
        const node = options.context.node as TreeNode;
        const selected = capture.selectedCategoryId.value === node.key;
        return {
          class: selected ? "font-semibold" : "",
          onContextmenu: (e: MouseEvent) => {
            e.preventDefault();
            onNodeContextMenu(e, node);
          },
        };
      },
    }));

    return () => {
      return (
        <div class="flex h-full flex-col gap-0 border-r border-[var(--p-content-border-color)] bg-surface-0 px-4">
          <div class="flex shrink-0 items-center justify-between pt-4 pl-3">
            <span class="pl-0.5 text-sm font-semibold text-muted-color">分类</span>
            <div class="flex items-center gap-0.5">
              <Button
                icon="pi pi-plus"
                text
                severity="secondary"
                size="small"
                title="新建分类"
                onClick={() => {
                  openCreateModal();
                }}
              />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto py-1 capture-scroll">
            <ContextMenu ref={cm} model={contextMenuItems.value} />

            <div class="flex flex-col gap-1">
              <Tree
                value={allNodeData}
                v-model:selectionKeys={selectedKey.value}
                selectionMode="single"
                pt={allTreePt}
                v-slots={{
                  default: ({ node }) => (
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                      <i class="pi pi-th-large text-sm text-muted-color" />
                      <span class="min-w-0 flex-1 truncate text-sm">{node.label}</span>
                    </div>
                  ),
                }}
              />

              <Tree
                v-model:value={treeData.value}
                v-model:expandedKeys={expandedKeys.value}
                v-model:selectionKeys={selectedKey.value}
                selectionMode="single"
                draggableNodes
                droppableNodes
                {...{ "onNode-drop": onNodeDrop }}
                pt={treePt.value}
                v-slots={{
                  default: ({ node }) => (
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                      <span class="min-w-0 flex-1 truncate text-sm">{node.label}</span>
                    </div>
                  ),
                }}
              />
            </div>
          </div>
        </div>
      );
    };
  },
});
