/**
 * Domain Workspace — styles implementation
 *
 * 对照 tokens.md 的 hierarchy 维护。
 * tokens.md 是设计意图；这里是落地 class。
 */

import { cn } from "@renderer/lib/utils";

type State = { selected?: boolean };

// ─── float card recipe ────────────────────────────────────────────────────────
//
// Light theme: --background = --card = oklch(1 0 0) 纯白; --muted = oklch(0.966)
// 解法：workspace 给 bg-muted/50（浅灰底），卡片用 bg-card（白）配 shadow 浮起来
// selected = 同色但 shadow 加强 + 细 ring，传递"桥接视线"的意图，不用改底色

const floatReset = "[--card-spacing:0] gap-0 !py-0 !ring-0";

const floatIdle = cn(
  floatReset,
  "rounded-xl border border-border/50 bg-card p-3 shadow-sm",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-border/80 hover:shadow",
);

const floatSelected = cn(
  floatReset,
  "rounded-xl border border-border bg-card p-3 shadow-md",
  "ring-1 ring-border/60",
);

// ─── section class map ────────────────────────────────────────────────────────
const s = {
  // Page shell
  page: "flex h-full w-full overflow-hidden text-foreground",

  // Left rail (tokens: ▁ ground, Sidebar)
  left: "w-[220px] shrink-0 bg-sidebar border-r border-border",
  leftTree: "flex flex-col gap-0.5",
  leftItem: "", // unused — isActive on SidebarMenuButton is enough

  // Workspace canvas (tokens: ▅ stage)
  // bg-muted/50 creates a gray surface so white cards float above it
  workspace: "flex min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/50",

  // Stream column (tokens: ▅ understanding-stream, fixed width)
  stream: "flex w-[320px] shrink-0 flex-col border-r border-border",
  streamHeader: "flex shrink-0 flex-col gap-2.5 border-b border-border/60 px-3 py-3",
  streamSearch:
    "h-7 w-full border-border/40 bg-background/60 text-xs shadow-none focus-visible:ring-1",
  streamContent: "flex flex-col gap-2 p-3",

  // Float cards (tokens: Card + float recipe)
  composeEntry: floatIdle,
  understandingCard: floatIdle,
  understandingCardSelected: floatSelected,
  sourcePreviewCard: floatIdle,
  composeDraft: cn(floatIdle, "gap-4"),

  // Reader pane (tokens: ▅ reader-pane, flex-1)
  reader: "flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background",
  // readerFrame: layout-only, invisible (tokens: no border, no bg)
  frame: "flex flex-col mx-auto w-full max-w-2xl min-h-full px-10 py-10 gap-8",

  // Doc header (tokens: ▂ tool, bottom divider)
  docHeader: "flex flex-col gap-3 border-b border-border/60 pb-6",
  // title: strip Input chrome → 2.125rem article title
  title: cn(
    "h-auto border-transparent bg-transparent px-0 shadow-none",
    "focus-visible:border-transparent focus-visible:ring-0",
    "text-[1.875rem] font-bold leading-tight tracking-tight text-foreground",
  ),
  // body: strip Textarea chrome → article body
  body: cn(
    "min-h-64 resize-none border-transparent bg-transparent px-0 shadow-none",
    "focus-visible:border-transparent focus-visible:ring-0",
    "text-base leading-[1.85] text-foreground",
  ),

  // Support area (tokens: ▂ tool)
  support: "flex flex-col gap-2 pt-2",
  // provenance: NOT Card (tokens: ▁ ground, whisper text row, no surface)
  provenance: "flex min-w-0 gap-4 pt-1",

  emptyState: "flex h-full items-center justify-center",

  // Context drawer (tokens: Sheet overlay)
  contextDrawer: "bg-card shadow-xl w-[min(720px,56vw)]",

  // Drawer title input — strip chrome, drawer-sized
  drawerTitleInput: cn(
    "mt-2 h-auto border-transparent bg-transparent px-0 shadow-none",
    "focus-visible:border-transparent focus-visible:ring-0",
    "text-lg font-semibold text-foreground",
  ),
} as const;

export type SectionKey = keyof typeof s;

export function sx(key: SectionKey, state?: State): string {
  if (key === "understandingCard" && state?.selected) return s.understandingCardSelected;
  return s[key];
}

export function lx(...keys: Array<"row" | "col" | "sm" | "md" | "lg" | "xs" | "xl">): string {
  const map: Record<string, string> = {
    row: "flex",
    col: "flex flex-col",
    xs: "gap-0.5",
    sm: "gap-1",
    md: "gap-2",
    lg: "gap-3",
    xl: "gap-8",
  };
  return cn(...keys.map((k) => map[k] ?? ""));
}

export const text = {
  whisper: "text-xs text-muted-foreground",
  navLabel: "text-sm text-foreground",
  cardTitle: "text-sm font-medium text-foreground",
  excerpt: "text-sm leading-6 text-muted-foreground",
  drawerTitle: "text-lg font-semibold text-foreground",
  field: "border-border/50 bg-muted/40 shadow-none",
} as const;

export const p: Record<string, SectionKey> = {
  page: "page",
  left: "left",
  leftTree: "leftTree",
  leftItem: "leftItem",
  workspace: "workspace",
  stream: "stream",
  streamHeader: "streamHeader",
  streamSearch: "streamSearch",
  streamContent: "streamContent",
  compose: "composeEntry",
  card: "understandingCard",
  reader: "reader",
  frame: "frame",
  docHeader: "docHeader",
  title: "title",
  body: "body",
  support: "support",
  preview: "sourcePreviewCard",
  provenance: "provenance",
  empty: "emptyState",
  contextDrawer: "contextDrawer",
  composeDraft: "composeDraft",
  drawerTitleInput: "drawerTitleInput",
};
