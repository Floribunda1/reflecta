import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../components/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "../components/combobox";
import { cn } from "../lib/utils";
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

function DomainTreeItems({
  nodes,
  level = 0,
}: {
  nodes: readonly DomainTreeSelectNode[];
  level?: number;
}) {
  return nodes.map((node) => (
    <div key={node.id}>
      <ComboboxItem
        value={node.id}
        className="rounded-md"
        style={{ paddingLeft: `calc(0.5rem + ${level} * 1rem)` }}
      >
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
      </ComboboxItem>
      {node.children.length ? <DomainTreeItems nodes={node.children} level={level + 1} /> : null}
    </div>
  ));
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

  const remove = (id: string) => {
    if (props.mode === "single") {
      props.onValueChange(null);
      return;
    }
    props.onValueChange(selectedIds.filter((selectedId) => selectedId !== id));
  };

  const statusLabel =
    status === "loading" ? "加载中…" : status === "error" ? errorText : placeholder;

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
      <div className={cn(fluid ? "w-full" : "inline-flex", variant === "inline" && "max-w-full")}>
        <ComboboxTrigger
          disabled={disabled || status !== "ready"}
          className={cn(
            "flex min-h-9 w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
            variant === "inline" && "border-none bg-transparent px-0 py-0 hover:bg-transparent",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {selectedNodes.length === 0 ? (
              <span
                className={cn("text-muted-foreground", status === "error" && "text-destructive")}
              >
                {statusLabel}
              </span>
            ) : (
              selectedNodes.map((node) => (
                <Badge key={node.id} variant="secondary" className="max-w-full">
                  <span className="truncate">{showPath ? node.pathLabel : node.label}</span>
                  <X
                    size={12}
                    className="shrink-0 text-muted-foreground"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      remove(node.id);
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
          <ComboboxEmpty>没有可选 Domain</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
