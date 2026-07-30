import { ListTree } from "lucide-react";
import { cn } from "#lib/utils";

export type ChatJumpNavItem = {
  messageId: string;
  label: string;
};

const MIN_ITEMS = 4;

export function ChatJumpNav({
  items,
  activeMessageId,
  onJump,
}: {
  items: readonly ChatJumpNavItem[];
  activeMessageId: string | null;
  onJump: (messageId: string) => void;
}) {
  if (items.length < MIN_ITEMS) return null;

  const activeIndex = items.findIndex((item) => item.messageId === activeMessageId);
  const activePosition = activeIndex >= 0 ? activeIndex + 1 : null;

  return (
    <nav
      data-testid="agent-chat-jump-nav"
      aria-label="消息跳转"
      className="group/jump pointer-events-auto absolute top-1/2 right-3 z-20 hidden max-h-[58%] -translate-y-1/2 xl:block"
    >
      <button
        type="button"
        data-testid="agent-chat-jump-trigger"
        aria-label={
          activePosition
            ? `打开消息导航，当前第 ${activePosition} 条，共 ${items.length} 条`
            : `打开消息导航，共 ${items.length} 条`
        }
        className="flex h-9 items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-2.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-opacity focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none group-hover/jump:pointer-events-none group-hover/jump:absolute group-hover/jump:opacity-0 group-focus-within/jump:pointer-events-none group-focus-within/jump:absolute group-focus-within/jump:opacity-0"
      >
        <ListTree className="size-4" />
        <span className="tabular-nums">
          {activePosition ?? "–"}/{items.length}
        </span>
      </button>

      <div className="hidden max-h-[58vh] w-72 flex-col overflow-hidden rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg group-hover/jump:flex group-focus-within/jump:flex">
        <div className="flex shrink-0 items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium">消息导航</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {activePosition ?? "–"} / {items.length}
          </span>
        </div>
        <div className="min-h-0 overflow-y-auto">
          {items.map((item) => {
            const active = item.messageId === activeMessageId;
            return (
              <button
                key={item.messageId}
                type="button"
                data-testid="agent-chat-jump-item"
                data-active={active ? "true" : undefined}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
                  active && "bg-accent font-medium text-foreground",
                )}
                onClick={() => onJump(item.messageId)}
              >
                <span
                  data-testid="agent-chat-jump-marker"
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full bg-muted-foreground/35",
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
