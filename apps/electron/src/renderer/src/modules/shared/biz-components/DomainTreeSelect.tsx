import { Badge } from "@renderer/components/ui/badge";
import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@renderer/components/ui/combobox";
import { X } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import type { DomainTreeNode } from "@shared/domain";
import {
  convertToTreeNodes,
  excludeTreeNodeKeys,
  flattenTreeNodes,
  type TreeSelectNode,
} from "./domain-tree-select-utils";
import { useCaptureDomains } from "@renderer/modules/capture/queries";

type DomainTreeSelectProps = {
  mode?: "multiple" | "single";
  modelValue?: string[];
  onUpdateModelValue?: (value: string[]) => void;
  "onUpdate:modelValue"?: (value: string[]) => void;
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  domains?: DomainTreeNode[];
  excludeIds?: string[];
  placeholder?: string;
  fluid?: boolean;
  usePathLabel?: boolean;
  variant?: "default" | "inline";
};

function DomainTreeItems({ nodes, level = 0 }: { nodes: TreeSelectNode[]; level?: number }) {
  return nodes.map((node) => (
    <div key={node.key}>
      <ComboboxItem
        value={node.key}
        className="rounded-md"
        style={{ paddingLeft: `calc(0.5rem + ${level} * 1rem)` }}
      >
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
      </ComboboxItem>
      {node.children.length > 0 && <DomainTreeItems nodes={node.children} level={level + 1} />}
    </div>
  ));
}

export function DomainTreeSelect({
  mode = "multiple",
  modelValue = [],
  onUpdateModelValue,
  "onUpdate:modelValue": onUpdateModelValueCompat,
  value,
  onValueChange,
  domains: domainsProp,
  excludeIds = [],
  placeholder = "选择 Domain",
  fluid = true,
  usePathLabel = true,
  variant = "default",
}: DomainTreeSelectProps) {
  const { domains, loading } = useCaptureDomains();
  const [open, setOpen] = useState(false);
  const sourceDomains = domainsProp ?? domains;
  const treeOptions = useMemo(() => {
    const nodes = convertToTreeNodes(sourceDomains);
    return excludeTreeNodeKeys(nodes, new Set(excludeIds));
  }, [excludeIds, sourceDomains]);
  const flatOptions = useMemo(() => flattenTreeNodes(treeOptions), [treeOptions]);
  const selectedKeys = mode === "single" ? (value ? [value] : []) : modelValue;
  const selectedNodes = flatOptions.filter((node) => selectedKeys.includes(node.key));
  const emitChange = onUpdateModelValue ?? onUpdateModelValueCompat;

  const toggle = (id: string) => {
    if (mode === "single") {
      onValueChange?.(selectedKeys.includes(id) ? null : id);
      setOpen(false);
      return;
    }

    const next = selectedKeys.includes(id)
      ? selectedKeys.filter((selectedKey) => selectedKey !== id)
      : [...selectedKeys, id];
    emitChange?.(next);
  };

  const handleComboboxValueChange = (next: string[]) => {
    if (mode === "single") {
      const added = next.find((key) => !selectedKeys.includes(key));
      onValueChange?.(added ?? next.at(-1) ?? null);
      setOpen(false);
      return;
    }

    emitChange?.(next);
  };

  return (
    <Combobox<string, true>
      multiple
      open={open}
      onOpenChange={setOpen}
      value={selectedKeys}
      onValueChange={handleComboboxValueChange}
      items={flatOptions.map((node) => node.key)}
      itemToStringLabel={(key) => flatOptions.find((node) => node.key === key)?.label ?? key}
    >
      <div
        className={cn(fluid ? "w-full" : "inline-flex", variant === "inline" ? "max-w-full" : "")}
      >
        <ComboboxTrigger
          className={cn(
            "flex min-h-9 w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
            variant === "inline" && "border-none bg-transparent px-0 py-0 hover:bg-transparent",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {selectedNodes.length === 0 ? (
              <span className="text-muted-foreground">{loading ? "加载中..." : placeholder}</span>
            ) : (
              selectedNodes.map((node) => (
                <Badge key={node.key} variant="secondary" className="max-w-full">
                  <span className="truncate">{usePathLabel ? node.pathLabel : node.label}</span>
                  <X
                    size={12}
                    className="shrink-0 text-muted-foreground"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggle(node.key);
                    }}
                  />
                </Badge>
              ))
            )}
          </span>
        </ComboboxTrigger>
      </div>
      <ComboboxContent className="min-w-64 p-1">
        <ComboboxList className="max-h-72 p-0">
          <DomainTreeItems nodes={treeOptions} />
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
