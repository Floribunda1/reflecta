import { Fragment, useMemo } from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
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
 * 画布浮动右键菜单：由 X6 contextmenu 事件在指针处弹出，用 base-ui ContextMenu。
 *
 * 不进 trigger 模型——把指针坐标做成 Floating UI VirtualElement 虚拟触点喂给
 * Positioner，base-ui 原生负责定位 / 翻转 / 碰撞、Esc 与外部点击关闭、焦点管理、
 * open/close 动画（样式与 shadcn ContextMenuItem / Content 完全一致）。
 */
export function CanvasContextMenu({
  x,
  y,
  sections,
  onClose,
}: {
  /** 视口坐标（clientX / clientY），consume 于 x6 contextmenu 事件 */
  x: number;
  y: number;
  /** 各分区渲染间以分隔线相隔；id 作稳定 key（结构与顺序固定，不用数组索引） */
  sections: { id: string; items: CanvasContextMenuItem[] }[];
  onClose: () => void;
}) {
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: () =>
        ({
          x,
          y,
          top: y,
          left: x,
          right: x,
          bottom: y,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    }),
    [x, y],
  );

  return (
    <ContextMenu.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ContextMenu.Portal>
        <ContextMenu.Positioner
          anchor={anchor}
          positionMethod="fixed"
          side="right"
          align="start"
          alignOffset={4}
          collisionPadding={8}
        >
          <ContextMenu.Popup className="z-50 min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {sections.map((section, i) => (
              <Fragment key={section.id}>
                {i > 0 ? <ContextMenu.Separator className="-mx-1 my-1" /> : null}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <ContextMenu.Item
                      key={item.id}
                      data-variant={item.destructive ? "destructive" : undefined}
                      data-testid={`canvas-context-${item.id}`}
                      disabled={item.disabled}
                      onClick={() => item.onSelect()}
                      className={cn(
                        "group/context-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none",
                        "focus:bg-accent focus:text-accent-foreground",
                        "data-disabled:pointer-events-none data-disabled:opacity-50",
                        "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive",
                        "dark:data-[variant=destructive]:focus:bg-destructive/20",
                        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                        "focus:*:[svg]:text-accent-foreground data-[variant=destructive]:*:[svg]:text-destructive",
                      )}
                    >
                      {Icon ? <Icon /> : null}
                      {item.label}
                    </ContextMenu.Item>
                  );
                })}
              </Fragment>
            ))}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
