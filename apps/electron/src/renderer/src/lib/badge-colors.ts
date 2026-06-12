export const semanticBadgeClass = {
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  accent: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  default: "",
} as const;

export type SemanticBadgeTone = keyof typeof semanticBadgeClass;
