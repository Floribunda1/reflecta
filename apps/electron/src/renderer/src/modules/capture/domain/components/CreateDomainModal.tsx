import { useState } from "react";
import { Button } from "@reflecta/ui/components/button";
import { DialogFooter } from "@reflecta/ui/components/dialog";
import { Input } from "@reflecta/ui/components/input";
import { DomainTreeSelect } from "@reflecta/ui/capture";
import type { DomainTreeNode } from "@shared/domain";

export type DomainModalData = {
  initialParentId?: string | null;
  editDomain?: { id: string; name: string; parentId: string | null };
  domains: DomainTreeNode[];
  onConfirm: (params: { name: string; parentId: string | null }) => void | Promise<void>;
  onClose: () => void;
};

export function DomainModalContent({ data }: { data: DomainModalData }) {
  const isEditing = !!data.editDomain;
  const [name, setName] = useState(data.editDomain?.name ?? "");
  const [parentId, setParentId] = useState<string | null>(
    isEditing ? (data.editDomain!.parentId ?? null) : (data.initialParentId ?? null),
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
        <DomainTreeSelect
          mode="single"
          value={parentId}
          onValueChange={setParentId}
          nodes={data.domains}
          excludedIds={data.editDomain ? [data.editDomain.id] : []}
          placeholder="无父领域"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={data.onClose}>
          取消
        </Button>
        <Button type="button" size="sm" disabled={!name.trim()} onClick={() => void submit()}>
          {isEditing ? "保存" : "新建"}
        </Button>
      </DialogFooter>
    </div>
  );
}
