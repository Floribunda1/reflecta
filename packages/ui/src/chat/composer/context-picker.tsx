import { useEffect, useRef } from "react";
import { m, MotionConfig } from "motion/react";
import { Search, SearchX } from "lucide-react";
import { EASE_OUT_EXPO, POP_IN_SCALE } from "#lib/motion";
import { ToggleGroup, ToggleGroupItem } from "#components/toggle-group";
import { Spinner } from "#components/spinner";
import { Command, CommandGroup, CommandItem, CommandList } from "#components/command";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "#components/empty";
import type { ChatComposerEntityOption, ChatEntityTypeFilter } from "../entity";
import {
  entityClassName,
  CHAT_ENTITY_ICON_FONT_SIZE,
  ENTITY_ICON_CLASS,
  entityIcon,
  entityKey,
} from "../entity-visual";

export function nextContextPickerIndex(currentIndex: number, count: number, step: number) {
  if (count <= 0) return 0;
  return (currentIndex + step + count) % count;
}

export type ChatContextPickerState = "idle" | "loading" | "ready" | "empty" | "error";

export type ChatComposerSkill = { name: string; description: string };

export function isLeadingSkillTrigger(textBeforeTrigger: string): boolean {
  return textBeforeTrigger.trim().length === 0;
}

export function filterChatComposerSkills(
  skills: readonly ChatComposerSkill[],
  query: string,
): readonly ChatComposerSkill[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return skills;
  return skills.filter((skill) =>
    `${skill.name} ${skill.description}`.toLowerCase().includes(normalized),
  );
}

type ChatContextPickerProps = {
  state: ChatContextPickerState;
  options: readonly ChatComposerEntityOption[];
  activeId?: string;
  activeType: ChatEntityTypeFilter;
  onTypeChange: (type: ChatEntityTypeFilter) => void;
  onSelect: (option: ChatComposerEntityOption) => void;
  onCancel: () => void;
};

/** @ 面板顶部类型 tab（顺序与左右方向键切换一致）。 */
const TYPE_TABS: { key: ChatEntityTypeFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "understanding", label: "理解" },
  { key: "context", label: "上下文" },
  { key: "domain", label: "领域" },
  { key: "canvas", label: "画布" },
];

/** 空态标题：按当前 tab 区分，避免全部类型共用一句“没有可选上下文”。 */
const EMPTY_TITLES: Record<ChatEntityTypeFilter, string> = {
  all: "没有可选上下文",
  understanding: "没有匹配的理解",
  context: "没有匹配的上下文",
  domain: "没有匹配的领域",
  canvas: "没有匹配的画布",
};

export function ChatContextPicker({
  state,
  options,
  activeId,
  activeType,
  onTypeChange,
  onSelect,
  onCancel,
}: ChatContextPickerProps) {
  const activeItemRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const emptyTitle = state === "error" ? "查找失败" : EMPTY_TITLES[activeType];

  return (
    <MotionConfig reducedMotion="user">
      <m.div
        initial={{ opacity: 0, scale: POP_IN_SCALE, transformOrigin: "bottom center" }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
      >
        <Command
          data-testid="agent-context-picker"
          className="relative border border-border shadow-sm"
          shouldFilter={false}
          value={activeId}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
        >
          <div className="border-b border-border p-2">
            <ToggleGroup
              value={activeType ? [activeType] : []}
              onValueChange={(groupValue) => {
                const next = groupValue[0] as ChatEntityTypeFilter | undefined;
                if (next) onTypeChange(next);
              }}
            >
              {TYPE_TABS.map((tab) => {
                const Icon = tab.key === "all" ? null : entityIcon(tab.key);
                return (
                  <ToggleGroupItem
                    key={tab.key}
                    value={tab.key}
                    data-testid="agent-context-type-tab"
                    data-context-type={tab.key}
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                  >
                    {Icon ? (
                      <Icon className="size-3 text-primary!" style={{ fontSize: 12 }} />
                    ) : null}
                    {tab.label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
          <CommandList>
            {state === "loading" ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Spinner />
                正在查找可引用内容...
              </div>
            ) : options.length > 0 ? (
              <CommandGroup>
                {options.map((option) => {
                  const value = entityKey(option);
                  const Icon = entityIcon(option.type);
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
                            {Icon ? (
                              <Icon
                                className={`${ENTITY_ICON_CLASS} text-primary!`}
                                style={{ fontSize: CHAT_ENTITY_ICON_FONT_SIZE }}
                              />
                            ) : null}
                            {option.label}
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
            ) : (
              <Empty className="py-8">
                <EmptyMedia variant="icon">
                  {state === "error" ? <SearchX /> : <Search />}
                </EmptyMedia>
                <EmptyContent>
                  <EmptyTitle>{emptyTitle}</EmptyTitle>
                  {state === "error" ? <EmptyDescription>请继续输入后重试</EmptyDescription> : null}
                </EmptyContent>
              </Empty>
            )}
          </CommandList>
        </Command>
      </m.div>
    </MotionConfig>
  );
}

export function ChatSkillPicker({
  options,
  activeName,
  onSelect,
  onCancel,
}: {
  options: readonly ChatComposerSkill[];
  activeName?: string;
  onSelect: (skill: ChatComposerSkill) => void;
  onCancel: () => void;
}) {
  const activeItemRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeName]);

  return (
    <MotionConfig reducedMotion="user">
      <m.div
        initial={{ opacity: 0, scale: POP_IN_SCALE, transformOrigin: "bottom center" }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
      >
        <Command
          data-testid="agent-skill-picker"
          className="border border-border shadow-sm"
          shouldFilter={false}
          value={activeName}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
        >
          <CommandList>
            {options.length > 0 ? (
              <CommandGroup heading="Skills">
                {options.map((skill) => (
                  <CommandItem
                    key={skill.name}
                    data-testid="agent-skill-option"
                    value={skill.name}
                    onMouseDown={(event) => event.preventDefault()}
                    onSelect={() => onSelect(skill)}
                  >
                    <span
                      ref={skill.name === activeName ? activeItemRef : undefined}
                      className="min-w-0 flex-1"
                    >
                      <span className="block truncate font-medium">${skill.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {skill.description}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <Empty className="py-8">
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyContent>
                  <EmptyTitle>没有匹配的 Skill</EmptyTitle>
                </EmptyContent>
              </Empty>
            )}
          </CommandList>
        </Command>
      </m.div>
    </MotionConfig>
  );
}
