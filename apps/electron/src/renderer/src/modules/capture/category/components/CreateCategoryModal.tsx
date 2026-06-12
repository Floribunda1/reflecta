import { useState } from "react";
import { Input } from "@renderer/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
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

  const options = flattenCategories(data.categories).filter(
    (category) => category.id !== data.editCategory?.id,
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
        <Select
          value={parentId ?? NONE_KEY}
          onValueChange={(value) => setParentId(value === NONE_KEY ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择父领域" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_KEY}>无父领域</SelectItem>
            {options.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {"  ".repeat(category.level)}
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
