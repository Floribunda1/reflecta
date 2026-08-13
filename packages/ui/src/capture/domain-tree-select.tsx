import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "../components/combobox";
import { cn } from "#lib/utils";
import type { DomainTreeNodeView } from "./domain-tree";
import {
  excludeDomainTreeSelectNodes,
  flattenDomainTreeSelectNodes,
  toDomainTreeSelectNodes,
  type DomainTreeSelectNode,
} from "./domain-tree-select-utils";

type DomainTreeSelectCommonProps = {
  nodes: readonly DomainTreeNodeView[];
  excludedIds?: readonly string[];
  status?: "ready" | "loading" | "error";
  errorText?: string;
  placeholder?: string;
  disabled?: boolean;
  fluid?: boolean;
  showPath?: boolean;
  variant?: "default" | "inline";
};

export type DomainTreeSelectProps = DomainTreeSelectCommonProps &
  (
    | {
        mode?: "multiple";
        value: readonly string[];
        onValueChange: (value: string[]) => void;
      }
    | {
        mode: "single";
        value: string | null;
        onValueChange: (value: string | null) => void;
      }
  );

/** id → 层级深度映射（候选面板按树形缩进展示，过滤后扁平渲染仍保留缩进） */
function collectLevels(
  nodes: readonly DomainTreeSelectNode[],
  level: number,
  out: Map<string, number>,
) {
  for (const node of nodes) {
    out.set(node.id, level);
    collectLevels(node.children, level + 1, out);
  }
}

export function DomainTreeSelect(props: DomainTreeSelectProps) {
  const {
    nodes,
    excludedIds = [],
    status = "ready",
    errorText = "Domain 加载失败",
    placeholder = "选择 Domain",
    disabled = false,
    fluid = true,
    showPath = true,
    variant = "default",
  } = props;
  const [open, setOpen] = useState(false);
  const treeOptions = useMemo(
    () => excludeDomainTreeSelectNodes(toDomainTreeSelectNodes(nodes), new Set(excludedIds)),
    [excludedIds, nodes],
  );
  const flatOptions = useMemo(() => flattenDomainTreeSelectNodes(treeOptions), [treeOptions]);
  const selectedIds = props.mode === "single" ? (props.value ? [props.value] : []) : props.value;
  const selectedIdSet = new Set(selectedIds);
  const selectedNodes = flatOptions.filter((node) => selectedIdSet.has(node.id));

  const changeValue = (next: string[]) => {
    if (props.mode === "single") {
      const added = next.find((id) => !selectedIdSet.has(id));
      props.onValueChange(added ?? next.at(-1) ?? null);
      setOpen(false);
      return;
    }
    props.onValueChange(next);
  };

  const statusLabel =
    status === "loading" ? "加载中…" : status === "error" ? errorText : placeholder;
  const anchorRef = useComboboxAnchor();
  const levelById = useMemo(() => {
    const map = new Map<string, number>();
    collectLevels(treeOptions, 0, map);
    return map;
  }, [treeOptions]);
  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of flatOptions) map.set(node.id, node.label);
    return map;
  }, [flatOptions]);

  return (
    <Combobox<string, true>
      multiple
      disabled={disabled || status !== "ready"}
      open={open}
      onOpenChange={setOpen}
      value={[...selectedIds]}
      onValueChange={changeValue}
      items={flatOptions.map((node) => node.id)}
      itemToStringLabel={(id) => flatOptions.find((node) => node.id === id)?.label ?? id}
    >
      <div
        ref={anchorRef}
        className={cn(fluid ? "w-full" : "inline-flex", variant === "inline" && "max-w-full")}
      >
        <ComboboxChips
          className={cn(
            "min-h-9 w-full gap-2 bg-background dark:bg-background hover:bg-muted",
            variant === "inline" &&
              "border-none bg-transparent dark:bg-transparent px-0 py-0 shadow-none hover:bg-transparent focus-within:border-transparent focus-within:ring-0",
          )}
        >
          {selectedNodes.length === 0 && status !== "ready" ? (
            <span
              className={cn(
                "shrink-0 text-sm",
                status === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {statusLabel}
            </span>
          ) : null}
          {selectedNodes.map((node) => (
            <ComboboxChip key={node.id} className="max-w-full">
              <span className="min-w-0 truncate">{showPath ? node.pathLabel : node.label}</span>
            </ComboboxChip>
          ))}
          <ComboboxChipsInput
            disabled={disabled || status !== "ready"}
            placeholder={selectedNodes.length === 0 && status === "ready" ? placeholder : undefined}
          />
        </ComboboxChips>
      </div>
      <ComboboxContent className="min-w-64 p-1" anchor={anchorRef}>
        <ComboboxList className="max-h-72 p-0">
          {(item) => (
            <ComboboxItem
              key={item}
              value={item}
              style={{ paddingLeft: `calc(0.5rem + ${levelById.get(item) ?? 0} * 1rem)` }}
            >
              <span className="min-w-0 flex-1 truncate">{labelById.get(item) ?? item}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>没有可选 Domain</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
