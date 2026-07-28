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

export function entityIcon(type: ChatEntityType | null) {
  if (type === "context") return "↳";
  if (type === "domain") return "#";
  return "✦";
}

export function entityTypeLabel(type: ChatEntityType) {
  if (type === "understanding") return "Understanding";
  if (type === "context") return "Context";
  return "Domain";
}

export function entityClassName(type: ChatEntityType | null) {
  const base =
    "mx-0.5 inline text-[1em] font-medium leading-[inherit] no-underline decoration-transparent";
  if (type === "context") return `${base} text-emerald-700 dark:text-emerald-300`;
  if (type === "domain") return `${base} text-violet-700 dark:text-violet-300`;
  return `${base} text-sky-700 dark:text-sky-300`;
}
