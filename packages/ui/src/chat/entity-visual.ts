import { createElement } from "react";
import { FileText, Quote, Tags, type LucideIcon } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChatEntityType } from "./entity";

export function entityKey(reference: { type: ChatEntityType; id: string }) {
  return `${reference.type}:${reference.id}`;
}

export function parseEntityKey(value: unknown): { type: ChatEntityType; id: string } | null {
  if (typeof value !== "string") return null;
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 1) return null;
  const type = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  if ((type !== "understanding" && type !== "context" && type !== "domain") || !id) return null;
  return { type, id };
}

const ENTITY_ICONS: Record<ChatEntityType, LucideIcon> = {
  understanding: FileText,
  context: Quote,
  domain: Tags,
};

export function entityIcon(type: ChatEntityType | null): LucideIcon | null {
  return type ? ENTITY_ICONS[type] : null;
}

/** Render an entity icon as a static SVG string for HTML-string contexts
 *  (compact markdown processor). Size comes from ENTITY_ICON_CLASS (1em) plus
 *  the given fontSize; lucide default width/height attributes are stripped so
 *  they never win. */
export function entityIconSvg(type: ChatEntityType | null, fontSize?: string): string {
  const Icon = entityIcon(type);
  if (!Icon) return "";
  return renderToStaticMarkup(
    createElement(Icon, {
      className: ENTITY_ICON_CLASS,
      ...(fontSize ? { style: { fontSize } } : {}),
    }),
  ).replace(/ width="\d+" height="\d+"/, "");
}

/** Build an entity icon as a live DOM node for tiptap/milkdown render output.
 *  renderHTML string children are treated as text, so the icon must be a node. */
export function entityIconDomNode(
  type: ChatEntityType | null,
  fontSize?: string,
): HTMLElement | null {
  const svg = entityIconSvg(type, fontSize);
  if (!svg || typeof document === "undefined") return null;
  const template = document.createElement("template");
  template.innerHTML = svg;
  return template.content.firstElementChild as HTMLElement | null;
}

export function entityClassName(_type: ChatEntityType | null) {
  // DESIGN: 实体提及统一用主色标识可点击性；类型（_type）区分靠图标，不靠颜色。
  // 容器保持 inline，让提及自然落在正文基线；图标对齐/间距由 ENTITY_ICON_CLASS 负责。
  const base =
    "mx-0.5 inline text-[1em] font-medium text-primary leading-[inherit] no-underline decoration-transparent";
  return base;
}

/** 实体图标在行内文本中的对齐与间距：size-[1em] 跟随当前字号，
 *  align-[-0.125em] 是图标行内垂直对齐的标准偏移（Bootstrap/Radix 同款），
 *  任何字号下都与正文基线对齐。 */
export const ENTITY_ICON_CLASS =
  "mr-1 inline-block align-[-0.125em] size-[1em] shrink-0 text-primary";

// DESIGN: 实体图标字号不靠 1em 隐式跟随 DOM 继承链——chat 界面里实体提及散布在
// 不同容器（markdown 流 13px、user 气泡/卡片 14px），1em 会各自跟随导致同一界面
// 图标忽大忽小。改用主题 scss 暴露的正文尺寸变量，按场景统一传入：
// chat 场景 13px、编辑器场景 14px。
/** chat 界面实体图标字号（--reflecta-chat-body-font-size，chat 正文 13px）。 */
export const CHAT_ENTITY_ICON_FONT_SIZE = "var(--reflecta-chat-body-font-size)";
/** 编辑器实体图标字号（--reflecta-md-body-font-size，编辑器正文 14px）。 */
export const EDITOR_ENTITY_ICON_FONT_SIZE = "var(--reflecta-md-body-font-size)";
