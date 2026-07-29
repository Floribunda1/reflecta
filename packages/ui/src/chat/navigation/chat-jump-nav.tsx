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

  return (
    <nav
      data-testid="agent-chat-jump-nav"
      aria-label="消息跳转"
      className="group/jump pointer-events-auto absolute top-1/2 right-1 z-20 hidden max-h-[58%] w-4 -translate-y-1/2 overflow-x-hidden overflow-y-hidden rounded-md border border-transparent bg-transparent p-0.5 shadow-none backdrop-blur transition-[width,padding,background-color,border-color,box-shadow] duration-150 hover:w-72 hover:overflow-y-auto hover:rounded-lg hover:border-border hover:bg-background/95 hover:p-2 hover:shadow-xl focus-within:w-72 focus-within:overflow-y-auto focus-within:rounded-lg focus-within:border-border focus-within:bg-background/95 focus-within:p-2 focus-within:shadow-xl xl:block"
    >
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
              "flex h-3 w-full items-center justify-center gap-2 rounded-md px-0 text-left text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none group-hover/jump:h-9 group-hover/jump:justify-start group-hover/jump:px-2 group-focus-within/jump:h-9 group-focus-within/jump:justify-start group-focus-within/jump:px-2",
              active && "font-medium text-primary",
            )}
            onClick={() => onJump(item.messageId)}
          >
            <span
              data-testid="agent-chat-jump-label"
              className="hidden min-w-0 flex-1 truncate group-hover/jump:block group-focus-within/jump:block"
            >
              {item.label}
            </span>
            <span
              data-testid="agent-chat-jump-marker"
              aria-hidden
              className={cn(
                "h-0.5 w-3 shrink-0 rounded-full bg-muted-foreground/40",
                active && "bg-primary",
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}
