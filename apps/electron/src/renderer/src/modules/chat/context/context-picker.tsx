import { useEffect, useRef } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@reflecta/ui/components/command";
import { contextMentionClass, contextMentionIcon, contextTitle } from "./context-reference";
import type { ContextCandidate } from "./context-mention-lookup";

function candidateValue(candidate: ContextCandidate) {
  return `${candidate.type}:${candidate.id}`;
}

export function nextContextPickerIndex(currentIndex: number, count: number, step: number) {
  if (count <= 0) return 0;
  return (currentIndex + step + count) % count;
}

export function ContextPicker({
  candidates,
  query,
  loading,
  onQueryChange,
  onSelect,
  onCancel,
  showInput = true,
  activeIndex = 0,
}: {
  candidates: ContextCandidate[];
  query: string;
  loading?: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (candidate: ContextCandidate) => void;
  onCancel: () => void;
  showInput?: boolean;
  activeIndex?: number;
}) {
  const activeCandidate = candidates[activeIndex];
  const activeValue = activeCandidate ? candidateValue(activeCandidate) : "";
  const activeItemRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeValue]);

  return (
    <Command
      data-testid="agent-context-picker"
      className="rounded-md border border-border shadow-sm"
      shouldFilter={false}
      value={activeValue}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      {showInput ? (
        <CommandInput
          autoFocus
          value={query}
          placeholder="搜索可引用内容..."
          onValueChange={onQueryChange}
        />
      ) : null}
      <CommandList>
        {loading && candidates.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">正在查找可引用内容...</div>
        ) : (
          <CommandEmpty>没有可选上下文</CommandEmpty>
        )}
        <CommandGroup>
          {candidates.map((candidate, index) => (
            <CommandItem
              key={candidateValue(candidate)}
              data-testid="agent-context-option"
              data-context-type={candidate.type}
              value={candidateValue(candidate)}
              onMouseDown={(event) => event.preventDefault()}
              onSelect={() => onSelect(candidate)}
            >
              <span
                ref={index === activeIndex ? activeItemRef : undefined}
                className="min-w-0 flex-1"
              >
                <span className="block truncate font-medium">
                  <span className={contextMentionClass(candidate.type)}>
                    {contextMentionIcon(candidate.type)} {contextTitle(candidate)}
                  </span>
                </span>
                {candidate.subtitle ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {candidate.subtitle}
                  </span>
                ) : null}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
