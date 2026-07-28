import { useEffect, useRef } from "react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "#components/command";
import type { ChatComposerEntityOption } from "../entity";
import { entityClassName, entityIcon, entityKey } from "../entity-visual";

export function nextContextPickerIndex(currentIndex: number, count: number, step: number) {
  if (count <= 0) return 0;
  return (currentIndex + step + count) % count;
}

export type ChatContextPickerState = "idle" | "loading" | "ready" | "empty" | "error";

type ChatContextPickerProps = {
  state: ChatContextPickerState;
  options: readonly ChatComposerEntityOption[];
  activeId?: string;
  onSelect: (option: ChatComposerEntityOption) => void;
  onCancel: () => void;
};

export function ChatContextPicker({
  state,
  options,
  activeId,
  onSelect,
  onCancel,
}: ChatContextPickerProps) {
  const activeItemRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const emptyLabel =
    state === "error"
      ? "查找失败，请继续输入后重试"
      : state === "loading"
        ? "正在查找可引用内容..."
        : "没有可选上下文";

  return (
    <Command
      data-testid="agent-context-picker"
      className="rounded-md border border-border shadow-sm"
      shouldFilter={false}
      value={activeId}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <CommandList>
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => {
            const value = entityKey(option);
            return (
              <CommandItem
                key={value}
                data-testid="agent-context-option"
                data-context-type={option.type}
                value={value}
                onMouseDown={(event) => event.preventDefault()}
                onSelect={() => onSelect(option)}
              >
                <span
                  ref={value === activeId ? activeItemRef : undefined}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate font-medium">
                    <span className={entityClassName(option.type)}>
                      {entityIcon(option.type)} {option.label}
                    </span>
                  </span>
                  {option.subtitle ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.subtitle}
                    </span>
                  ) : null}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
