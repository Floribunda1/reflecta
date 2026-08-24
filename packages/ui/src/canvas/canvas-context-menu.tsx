import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

export type CanvasContextMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * 画布浮动右键菜单：由 X6 contextmenu 事件在指针处弹出。
 * 比 base-ui ContextMenu（需 trigger 元素）更贴合 graph 级多选 / 空白处菜单。
 */
export function CanvasContextMenu({
  x,
  y,
  containerWidth,
  sections,
  onClose,
}: {
  x: number;
  y: number;
  containerWidth: number;
  /** 各分区渲染间以分隔线相隔 */
  sections: { items: CanvasContextMenuItem[] }[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const WIDTH = 188;
  const left = Math.min(Math.max(4, x), Math.max(4, containerWidth - WIDTH - 8));

  return (
    <>
      {/* 全屏透明遮罩：点任意处关闭菜单 */}
      <div
        className="absolute inset-0 z-30"
        onPointerDown={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        data-testid="canvas-context-menu"
        className="absolute z-40 min-w-[188px] rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        style={{ left, top: y }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {sections.map((section, i) => (
          <div key={i} className={i > 0 ? "-mx-1 my-1 border-t pt-1" : ""}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  data-testid={`canvas-context-${item.id}`}
                  onClick={() => {
                    onClose();
                    item.onSelect();
                  }}
                  className={cn(
                    "flex w-full cursor-default items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-hidden select-none",
                    "focus:bg-accent focus:text-accent-foreground",
                    "disabled:pointer-events-none disabled:opacity-50",
                    item.destructive &&
                      "text-destructive focus:bg-destructive/10 focus:text-destructive",
                    "[&_svg]:size-4 [&_svg]:shrink-0",
                  )}
                >
                  {Icon ? <Icon /> : null}
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
