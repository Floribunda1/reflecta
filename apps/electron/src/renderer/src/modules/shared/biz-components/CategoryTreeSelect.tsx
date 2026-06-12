import { Badge } from "@renderer/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@renderer/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";
import { useCategoryData } from "@renderer/modules/shared/hooks/use-category";
import type { CategoryTreeNode } from "@shared/category";

export interface TreeSelectNode {
  key: string;
  label: string;
  pathLabel: string;
  children?: TreeSelectNode[];
}

type CategoryTreeSelectProps = {
  modelValue?: string[];
  onUpdateModelValue?: (value: string[]) => void;
  "onUpdate:modelValue"?: (value: string[]) => void;
  placeholder?: string;
  fluid?: boolean;
  usePathLabel?: boolean;
  variant?: "default" | "inline";
};

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

function flatten(nodes: TreeSelectNode[]): TreeSelectNode[] {
  return nodes.flatMap((node) => [node, ...(node.children ? flatten(node.children) : [])]);
}

export function CategoryTreeSelect({
  modelValue = [],
  onUpdateModelValue,
  "onUpdate:modelValue": onUpdateModelValueCompat,
  placeholder = "选择 Category",
  fluid = true,
  usePathLabel = true,
  variant = "default",
}: CategoryTreeSelectProps) {
  const { categories, loading } = useCategoryData();
  const [open, setOpen] = useState(false);
  const treeOptions = useMemo(() => convertToTreeNodes(categories), [categories]);
  const flatOptions = useMemo(() => flatten(treeOptions), [treeOptions]);
  const selectedNodes = flatOptions.filter((node) => modelValue.includes(node.key));
  const emitChange = onUpdateModelValue ?? onUpdateModelValueCompat;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggle = (id: string) => {
    const next = modelValue.includes(id)
      ? modelValue.filter((value) => value !== id)
      : [...modelValue, id];
    emitChange?.(next);
  };

  return (
    <div
      className={[
        "relative",
        fluid ? "w-full" : "inline-flex",
        variant === "inline" ? "max-w-full" : "",
      ].join(" ")}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={[
          "flex min-h-9 w-full items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
          variant === "inline" ? "border-none bg-transparent px-0 py-0 hover:bg-transparent" : "",
        ].join(" ")}
        onClick={() => setOpen((value) => !value)}
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
                    event.stopPropagation();
                    toggle(node.key);
                  }}
                />
              </Badge>
            ))
          )}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full min-w-64 overflow-auto rounded-xl border border-border bg-white p-1 shadow-xl">
          {flatOptions.map((node) => (
            <label
              key={node.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              <Checkbox
                checked={modelValue.includes(node.key)}
                onCheckedChange={() => toggle(node.key)}
              />
              <span className="min-w-0 flex-1 truncate">
                {usePathLabel ? node.pathLabel : node.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
