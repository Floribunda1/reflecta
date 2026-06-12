import { useMemo, useState } from "react";
import { Input } from "@renderer/components/ui/input";
import type { CategoryTreeNode } from "@shared/category";
import { FooterButton } from "@renderer/modules/shared/components/footer-button";

export type CategoryModalData = {
  initialParentId?: string | null;
  editCategory?: { id: string; name: string; parentId: string | null };
  categories: CategoryTreeNode[];
  onConfirm: (params: { name: string; parentId: string | null }) => void | Promise<void>;
  onClose: () => void;
};

const NONE_KEY = "__none__";

function flattenCategories(
  categories: CategoryTreeNode[],
  level = 0,
): Array<CategoryTreeNode & { level: number }> {
  return categories.flatMap((category) => [
    { ...category, level },
    ...flattenCategories(category.children, level + 1),
  ]);
}

export function CategoryModalContent({ data }: { data: CategoryModalData }) {
  const isEditing = !!data.editCategory;
  const [name, setName] = useState(data.editCategory?.name ?? "");
  const [parentId, setParentId] = useState<string | null>(
    isEditing ? (data.editCategory!.parentId ?? null) : (data.initialParentId ?? null),
  );

  const options = useMemo(
    () =>
      flattenCategories(data.categories).filter(
        (category) => category.id !== data.editCategory?.id,
      ),
    [data.categories, data.editCategory?.id],
  );

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await data.onConfirm({ name: trimmed, parentId });
    data.onClose();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">名称</label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="领域名称"
          aria-label="领域名称"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">父领域</label>
        <select
          value={parentId ?? NONE_KEY}
          onChange={(event) =>
            setParentId(event.target.value === NONE_KEY ? null : event.target.value)
          }
          className="h-10 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        >
          <option value={NONE_KEY}>无父领域</option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {"  ".repeat(category.level)}
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <FooterButton
        cancelProps={{ onClick: data.onClose }}
        okProps={{
          onClick: () => void submit(),
          disabled: !name.trim(),
          children: isEditing ? "保存" : "新建",
        }}
      />
    </div>
  );
}
