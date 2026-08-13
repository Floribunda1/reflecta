import { ListTree } from "lucide-react";
import { cn } from "#lib/utils";

export type ChatJumpNavItem = {
  turnId: string;
  label: string;
};

const MIN_ITEMS = 4;

export function ChatJumpNav({
  items,
  activeTurnId,
  onJump,
}: {
  items: readonly ChatJumpNavItem[];
  activeTurnId: string | null;
  onJump: (turnId: string) => void;
}) {
  // DESIGN: 跳转导航是「贴右边缘的展开条」——hover/focus 时 trigger 原地隐藏、
  // 面板在同一位置展开（group-hover/jump + group-focus-within/jump 纯 CSS 实现，
  // 无 JS 状态）。刻意不用 HoverCard：那会让面板浮在 trigger 旁，破坏「沿边缘
  // 滑出」的交互；且展开/收起由鼠标停留状态驱动，无需 Popper 定位成本。
  if (items.length < MIN_ITEMS) return null;

  const activeIndex = items.findIndex((item) => item.turnId === activeTurnId);
  const activePosition = activeIndex >= 0 ? activeIndex + 1 : null;

  return (
    <nav
      data-testid="agent-chat-jump-nav"
      aria-label="对话轮次跳转"
      className="group/jump pointer-events-auto absolute top-4 right-0 z-20 hidden max-h-[58%] min-[18rem]:block"
    >
      <button
        type="button"
        data-testid="agent-chat-jump-trigger"
        aria-label={
          activePosition
            ? `打开对话轮次导航，当前第 ${activePosition} 轮，共 ${items.length} 轮`
            : `打开对话轮次导航，共 ${items.length} 轮`
        }
        className="flex h-11 min-w-7 flex-col items-center justify-center gap-0.5 rounded-l-md border-y border-l border-border bg-background px-1 text-muted-foreground backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-hover/jump:pointer-events-none group-hover/jump:absolute group-hover/jump:opacity-0 group-focus-within/jump:pointer-events-none group-focus-within/jump:absolute group-focus-within/jump:opacity-0"
      >
        <ListTree aria-hidden className="size-3.5" />
        {/* DESIGN: 位置数字用 9px——触发条是窄竖条（min-w-7=28px），text-body-small
        （12px）放不下「3/42」这类宽度；9px 是功能指示非正文，刻意不套字号 token。 */}
        <span
          data-testid="agent-chat-jump-position"
          className="text-[9px] leading-none tabular-nums"
        >
          {activePosition ?? "–"}/{items.length}
        </span>
      </button>

      <div className="hidden max-h-[58vh] w-72 flex-col overflow-hidden rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg group-hover/jump:flex group-focus-within/jump:flex">
        <div className="flex shrink-0 items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium">对话轮次</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {activePosition ?? "–"} / {items.length}
          </span>
        </div>
        <div className="min-h-0 overflow-y-auto">
          {items.map((item) => {
            const active = item.turnId === activeTurnId;
            return (
              <button
                key={item.turnId}
                type="button"
                data-testid="agent-chat-jump-item"
                data-active={active ? "true" : undefined}
                aria-current={active ? "location" : undefined}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
                  active && "bg-accent font-medium text-foreground",
                )}
                onClick={() => onJump(item.turnId)}
              >
                <span
                  data-testid="agent-chat-jump-marker"
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full bg-muted-foreground",
                    active && "bg-primary",
                  )}
                />
                <span data-testid="agent-chat-jump-label" className="min-w-0 flex-1 truncate">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
