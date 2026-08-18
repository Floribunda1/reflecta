import { useEffect, useRef, useState } from "react";
import { PackageOpen, Trash2, Ungroup } from "lucide-react";
import type { Node } from "@antv/x6";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../components/context-menu";
import type { CanvasElementDTO } from "../document";
import { useCanvasShapeData } from "../shape-context";

/**
 * 组（M3-D）：显式边框 + 标题栏；组名双击就地编辑；右键菜单支持
 * 「删除组（级联删组内元素）」与「解除组（子元素回画布自由态）」。
 * 嵌套 / 入组出组由 X6 embedding（addTo 双向）承载，本组件只负责外观与组名。
 */
export function CanvasGroupNode({ node }: { node: Node }) {
  const element = node.getData<CanvasElementDTO>();
  const label = element.kind === "group" ? element.props.label : "";
  const { onCellAction } = useCanvasShapeData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setDraft(label);
    setEditing(true);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft === label) return;
    node.setData<CanvasElementDTO>({
      ...element,
      props: { ...element.props, label: draft },
    } as CanvasElementDTO);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            data-testid="canvas-group-node"
            data-group-label={label}
            className="flex h-full w-full flex-col overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/50 bg-muted/10"
          >
            <div
              data-testid="canvas-group-label"
              className="flex shrink-0 cursor-grab items-center gap-1.5 border-b border-muted-foreground/30 bg-muted/40 px-2 py-1"
              onDoubleClick={startEditing}
            >
              <PackageOpen size={12} className="shrink-0 text-muted-foreground" />
              {editing ? (
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commit}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setDraft(label);
                      setEditing(false);
                    }
                    if (event.key === "Enter") commit();
                  }}
                  className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                  aria-label="组名"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {label || "未命名组"}
                </span>
              )}
            </div>
            {/* 组体透明：子元素由 X6 embedding 叠放其上 */}
            <div className="min-h-0 flex-1" />
          </div>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem
          data-testid="canvas-group-ungroup"
          onClick={() => onCellAction?.({ type: "ungroup", nodeId: node.id })}
        >
          <Ungroup size={14} />
          解除组
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          data-testid="canvas-group-delete"
          variant="destructive"
          onClick={() => onCellAction?.({ type: "delete-group", nodeId: node.id })}
        >
          <Trash2 size={14} />
          删除组（含组内内容）
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
