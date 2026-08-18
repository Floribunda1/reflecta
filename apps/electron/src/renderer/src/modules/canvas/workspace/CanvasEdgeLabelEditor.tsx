import { useEffect, useRef, useState } from "react";
import type { Edge, Graph } from "@antv/x6";
import { Input } from "@reflecta/ui/components/input";
import type { CanvasEdgeDTO } from "@reflecta/ui/canvas";
import { applyEdgeLabel } from "@reflecta/ui/canvas";

/**
 * 连线标签就地编辑（M4-3）：双击连线 → 在边中点渲染输入框；
 * 失焦 / Enter 提交写回边 data.label，随连线移动、持久化（事件桥 → saveCanvas）。
 * 定位用 client 坐标（position: fixed）。
 */
export function CanvasEdgeLabelEditor({
  graph,
  edgeId,
  position,
  onClose,
}: {
  graph: Graph | null;
  edgeId: string;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const closed = useRef(false);

  const edge = graph?.getCellById(edgeId) as Edge | null;

  useEffect(() => {
    setLabel(edge?.getData<CanvasEdgeDTO>()?.label ?? "");
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeId, edge?.id]);

  const closeOnce = () => {
    if (!closed.current) {
      closed.current = true;
      onClose();
    }
  };

  const commit = () => {
    const current = graph?.getCellById(edgeId) as Edge | null;
    if (current) {
      const data = current.getData<CanvasEdgeDTO>();
      const nextLabel = label.trim() ? label.trim() : null;
      applyEdgeLabel(current, nextLabel);
      current.setData({ ...data, label: nextLabel });
    }
    closeOnce();
  };

  return (
    <div
      data-testid="canvas-edge-label-editor"
      className="fixed z-50 -translate-x-1/2 -translate-y-1/2"
      style={{ left: position.x, top: position.y }}
    >
      <Input
        ref={inputRef}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          else if (event.key === "Escape") closeOnce();
          event.stopPropagation();
        }}
        placeholder="连线标签"
        aria-label="连线标签"
        data-testid="canvas-edge-label-input"
        className="w-44 bg-popover text-xs"
        onMouseDown={(event) => event.stopPropagation()}
      />
    </div>
  );
}
