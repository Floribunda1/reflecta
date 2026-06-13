import { useState } from "react";
import { Input } from "@renderer/components/ui/input";
import type { CategoryTreeNode } from "@shared/category";
import { FooterButton } from "@renderer/modules/shared/components/footer-button";
import { CategoryTreeSelect } from "@renderer/modules/shared/biz-components/CategoryTreeSelect";

export type CategoryModalData = {
  initialParentId?: string | null;
  editCategory?: { id: string; name: string; parentId: string | null };
  categories: CategoryTreeNode[];
  onConfirm: (params: { name: string; parentId: string | null }) => void | Promise<void>;
  onClose: () => void;
};

export function CategoryModalContent({ data }: { data: CategoryModalData }) {
  const isEditing = !!data.editCategory;
  const [name, setName] = useState(data.editCategory?.name ?? "");
  const [parentId, setParentId] = useState<string | null>(
    isEditing ? (data.editCategory!.parentId ?? null) : (data.initialParentId ?? null),
  );

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await data.onConfirm({ name: trimmed, parentId });
    data.onClose();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium">名称</label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="领域名称"
          aria-label="领域名称"
          autoFocus
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">父领域</label>
        <CategoryTreeSelect
          mode="single"
          value={parentId}
          onValueChange={setParentId}
          categories={data.categories}
          excludeIds={data.editCategory ? [data.editCategory.id] : []}
          placeholder="无父领域"
        />
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
