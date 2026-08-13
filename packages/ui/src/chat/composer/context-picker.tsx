import { useEffect, useRef } from "react";
import { motion, MotionConfig } from "motion/react";
import { EASE_OUT_EXPO, POP_IN_SCALE } from "#lib/motion";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "#components/command";
import type { ChatComposerEntityOption } from "../entity";
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
    <MotionConfig reducedMotion="user">
      <motion.div
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
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
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
          </CommandList>
        </Command>
      </motion.div>
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
      <motion.div
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
            <CommandEmpty>没有匹配的 Skill</CommandEmpty>
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
          </CommandList>
        </Command>
      </motion.div>
    </MotionConfig>
  );
}
