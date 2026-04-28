import { ref, computed, defineComponent, inject } from "vue";
import type { CategoryTreeNode } from "@shared/category";
import InputText from "primevue/inputtext";
import Tree from "primevue/tree";
import { FooterButton } from "@renderer/modules/shared/components/footer-button";
import type { DynamicDialogInstance } from "primevue/dynamicdialogoptions";
import { Ref } from "vue";

const NONE_KEY = "__none__";

interface EditCategory {
  id: string;
  name: string;
  parentId: string | null;
}

interface TreeNode {
  key: string;
  label: string;
  children?: TreeNode[];
}

interface CategoryModalData {
  initialParentId?: string;
  editCategory?: EditCategory;
  categories: CategoryTreeNode[];
  onConfirm?: (params: { name: string; parentId: string | null }) => void;
}

function convertToParentOptions(categories: CategoryTreeNode[], excludeId?: string): TreeNode[] {
  return categories
    .filter((cat) => cat.id !== excludeId)
    .map((cat) => ({
      key: cat.id,
      label: cat.name,
      children:
        cat.children.length > 0 ? convertToParentOptions(cat.children, excludeId) : undefined,
    }));
}

function collectAllKeys(nodes: TreeNode[]): Record<string, boolean> {
  const keys: Record<string, boolean> = {};
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      keys[node.key] = true;
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return keys;
}

export const CategoryModalContent = defineComponent({
  setup() {
    const dialogRef = inject<Ref<DynamicDialogInstance>>("dialogRef")!;
    const data = dialogRef.value.data as CategoryModalData;
    const closeDialog = () => {
      dialogRef.value.close();
    };

    const isEditing = computed(() => !!data.editCategory);
    const name = ref(data.editCategory?.name ?? "");
    const parentId = ref<string | null>(
      isEditing.value ? (data.editCategory!.parentId ?? null) : (data.initialParentId ?? null),
    );

    const parentTreeNodes = computed<TreeNode[]>(() => [
      { key: NONE_KEY, label: "无（顶级分类）" },
      ...convertToParentOptions(data.categories, data.editCategory?.id),
    ]);

    const expandedKeys = computed(() => collectAllKeys(parentTreeNodes.value));

    const selectedParentKeys = computed<Record<string, boolean>>(() =>
      parentId.value ? { [parentId.value]: true } : { [NONE_KEY]: true },
    );

    const handleParentSelect = (val: Record<string, boolean>) => {
      const key = Object.keys(val)[0];
      parentId.value = key && key !== NONE_KEY ? key : null;
    };

    const handleSubmit = async () => {
      const trimmed = name.value.trim();
      if (!trimmed) return;
      await data.onConfirm?.({
        name: trimmed,
        parentId: parentId.value,
      });
      closeDialog();
    };

    return () => (
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-color">名称</label>
          <InputText
            value={name.value}
            onInput={(e) => {
              name.value = (e.target as HTMLInputElement).value;
            }}
            placeholder="分类名称"
            autofocus
            class="w-full"
            onKeydown={(e: KeyboardEvent) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-color">父分类</label>
          <Tree
            value={parentTreeNodes.value}
            selectionMode="single"
            selectionKeys={selectedParentKeys.value}
            {...{ "onUpdate:selectionKeys": handleParentSelect }}
            expandedKeys={expandedKeys.value}
            pt={{
              root: { class: "!p-1" },
              nodeContent: { class: "!px-1 !py-1 !gap-0.5" },
              nodeToggleButton: { class: "!w-6 shrink-0" },
              nodeToggleIcon: { class: "!w-3 !h-3" },
            }}
            class="max-h-48 w-full overflow-auto rounded-lg border border-surface p-0"
          />
        </div>

        <FooterButton
          cancelProps={{
            text: true,
            onClick: closeDialog,
          }}
          okProps={{
            disabled: !name.value.trim(),
            onClick: handleSubmit,
          }}
        />
      </div>
    );
  },
});
