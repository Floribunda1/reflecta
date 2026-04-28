import { defineComponent, computed, type PropType, ref, watch } from "vue";
import TreeSelect from "primevue/treeselect";
import Chip from "primevue/chip";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import type { CategoryTreeNode } from "@shared/category";

export interface TreeSelectNode {
  key: string;
  label: string;
  pathLabel: string;
  children?: TreeSelectNode[];
}

function convertToTreeNodes(categories: CategoryTreeNode[], parentPath = ""): TreeSelectNode[] {
  return categories.map((cat) => {
    const pathLabel = parentPath ? `${parentPath} > ${cat.name}` : cat.name;
    return {
      key: cat.id,
      label: cat.name,
      pathLabel,
      children: cat.children.length > 0 ? convertToTreeNodes(cat.children, pathLabel) : undefined,
    };
  });
}

function getAllKeys(nodes: TreeSelectNode[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    keys.push(node.key);
    if (node.children) {
      keys.push(...getAllKeys(node.children));
    }
  }
  return keys;
}

export const CategoryTreeSelect = defineComponent({
  name: "CategoryTreeSelect",
  props: {
    modelValue: {
      type: [Array, Object] as PropType<string[]>,
      default: () => [],
    },
    placeholder: {
      type: String,
      default: "选择 Category",
    },
    fluid: {
      type: Boolean,
      default: true,
    },
    usePathLabel: {
      type: Boolean,
      default: true,
    },
    variant: {
      type: String as PropType<"default" | "inline">,
      default: "default",
    },
    pt: {
      type: Object as PropType<Record<string, unknown>>,
      default: () => ({}),
    },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const { categories, loading } = useCategoryData();

    const treeOptions = computed<TreeSelectNode[]>(() => {
      return convertToTreeNodes(categories.value);
    });

    const expandedKeys = ref<Record<string, boolean>>({});

    // Auto expand all when options change
    watch(
      treeOptions,
      (nodes) => {
        const allKeys = getAllKeys(nodes);
        expandedKeys.value = Object.fromEntries(allKeys.map((k) => [k, true]));
      },
      { immediate: true },
    );

    const selectedValue = computed({
      get: () => {
        if (props.modelValue.length === 0) return null;
        return props.modelValue.reduce((acc, cur) => ({ ...acc, [cur]: true }), {});
      },
      set: (val) => {
        const selectedKeys = val
          ? Object.entries(val)
              .filter(([_, v]) => v)
              .map(([v, _]) => v)
          : [];
        emit("update:modelValue", selectedKeys);
      },
    });

    const inlinePt = computed<Record<string, unknown>>(() => {
      if (props.variant !== "inline") return {};
      return {
        root: {
          class:
            "inline-flex max-w-full items-center gap-1 rounded-none border-none bg-transparent shadow-none outline-none",
        },
        labelContainer: {
          class: "min-w-0 shrink px-0 py-0",
        },
        label: {
          class: "flex max-w-full flex-wrap items-center gap-1.5 text-sm font-medium text-color",
        },
        chipItem: {
          class: "!m-0",
        },
        pcChip: {
          root: {
            class:
              "!rounded-md !border !border-[var(--p-content-border-color)] !bg-surface-100 !px-2 !py-1 !text-xs !font-semibold !text-color !shadow-none",
          },
          label: {
            class: "!px-0",
          },
        },
        clearIcon: {
          class: "!hidden",
        },
        dropdown: {
          class:
            "flex h-6 w-6 shrink-0 items-center justify-center self-center rounded text-muted-color transition-colors hover:bg-surface-100 hover:text-color",
        },
        dropdownIcon: {
          class: "h-2.5 w-2.5",
        },
      };
    });

    const resolvedPt = computed(() => ({ ...inlinePt.value, ...props.pt }));

    return () => (
      <TreeSelect
        v-model={selectedValue.value}
        options={treeOptions.value}
        selectionMode="multiple"
        placeholder={props.placeholder}
        showClear
        size="small"
        loading={loading.value}
        display="chip"
        expandedKeys={expandedKeys.value}
        filter
        filterPlaceholder="搜索 Category..."
        {...{
          "onUpdate:expandedKeys": (keys: Record<string, boolean>) => {
            expandedKeys.value = keys;
          },
        }}
        pt={resolvedPt.value}
        fluid={props.fluid}
        v-slots={{
          ...(props.variant === "inline"
            ? { dropdownicon: () => <i class="pi pi-chevron-down text-xs" /> }
            : {}),
          value: ({ value: selectedNodes }: { value: TreeSelectNode[] }) => {
            if (!selectedNodes || selectedNodes.length === 0) {
              return <span style="color: var(--p-text-muted-color)">{props.placeholder}</span>;
            }
            const chipPt =
              typeof props.pt === "object" && props.pt !== null
                ? ((resolvedPt.value as Record<string, unknown>).pcChip as Record<string, unknown>)
                : undefined;
            return selectedNodes.map((node) => (
              <div key={node.key} class="inline-flex items-center">
                <Chip
                  label={props.usePathLabel ? node.pathLabel || node.label : node.label}
                  pt={chipPt}
                />
              </div>
            ));
          },
        }}
      />
    );
  },
});
