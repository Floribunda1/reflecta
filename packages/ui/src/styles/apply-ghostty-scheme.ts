import type { PairedGhosttyTheme } from "./ghostty-themes";

const BASE_KEYS = [
  "base00",
  "base01",
  "base02",
  "base03",
  "base04",
  "base05",
  "base06",
  "base07",
  "base08",
  "base09",
  "base0a",
  "base0b",
  "base0c",
  "base0d",
  "base0e",
  "base0f",
] as const;

const ACCENT_KEYS = [
  "primary",
  "ring",
  "sidebar-primary",
  "sidebar-ring",
  "primary-foreground",
  "sidebar-primary-foreground",
] as const;

/** Base16 强调色槽（base08–0F），可被选作 primary。 */
export const CHROMATIC_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15] as const;
export type ChromaticSlot = (typeof CHROMATIC_SLOTS)[number];
/** 默认主色：base0D（Apple System Colors 的系统蓝）。 */
export const DEFAULT_PRIMARY_SLOT: ChromaticSlot = 13;

export function isChromaticSlot(value: unknown): value is ChromaticSlot {
  return typeof value === "number" && (CHROMATIC_SLOTS as readonly number[]).includes(value);
}

/** 与 tokens.css :root / .dark 的 Default Light/Dark 对齐，供默认主题选槽。 */
export const DEFAULT_LIGHT_BASE = [
  "#f8f8f8",
  "#e8e8e8",
  "#d8d8d8",
  "#b8b8b8",
  "#585858",
  "#383838",
  "#282828",
  "#181818",
  "#ab4642",
  "#dc9656",
  "#b58900",
  "#86a361",
  "#0d9488",
  "#3c6fb4",
  "#7c5c9e",
  "#8a5a3b",
] as const;

export const DEFAULT_DARK_BASE = [
  "#181818",
  "#282828",
  "#383838",
  "#585858",
  "#b8b8b8",
  "#d8d8d8",
  "#e8e8e8",
  "#f8f8f8",
  "#ab4642",
  "#dc9656",
  "#e8c15a",
  "#9fc06f",
  "#2dd4bf",
  "#7cafc2",
  "#ba8baf",
  "#a16946",
] as const;

export function themePalette(
  theme: PairedGhosttyTheme | null | undefined,
  mode: "light" | "dark",
): readonly string[] {
  if (!theme) return mode === "dark" ? DEFAULT_DARK_BASE : DEFAULT_LIGHT_BASE;
  return mode === "dark" ? theme.dark : theme.light;
}

export function chromaticSwatches(theme?: PairedGhosttyTheme | null) {
  const light = themePalette(theme, "light");
  const dark = themePalette(theme, "dark");
  return CHROMATIC_SLOTS.map((slot) => ({
    slot,
    key: BASE_KEYS[slot]!,
    light: light[slot]!,
    dark: dark[slot]!,
  }));
}

function channel(hex: string, offset: number) {
  return Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
}

function linearize(channelValue: number) {
  return channelValue <= 0.03928 ? channelValue / 12.92 : ((channelValue + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string) {
  const value = hex.startsWith("#") ? hex.slice(1) : hex;
  const red = linearize(channel(value, 0));
  const green = linearize(channel(value, 2));
  const blue = linearize(channel(value, 4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastForeground(accent: string, candidateA: string, candidateB: string) {
  const accentLuminance = relativeLuminance(accent);
  const contrastA = Math.abs(accentLuminance - relativeLuminance(candidateA));
  const contrastB = Math.abs(accentLuminance - relativeLuminance(candidateB));
  return contrastA >= contrastB ? candidateA : candidateB;
}

export function applyGhosttyScheme(
  root: HTMLElement,
  theme: PairedGhosttyTheme | null | undefined,
  mode: "light" | "dark",
  primarySlot?: ChromaticSlot | null,
) {
  for (const key of BASE_KEYS) root.style.removeProperty(`--${key}`);
  for (const key of ACCENT_KEYS) root.style.removeProperty(`--${key}`);

  const base = themePalette(theme, mode);
  if (theme) {
    base.forEach((value, index) => {
      root.style.setProperty(`--${BASE_KEYS[index]}`, value);
    });
  }

  const themeAccent = theme ? (mode === "dark" ? theme.darkAccent : theme.lightAccent) : undefined;
  const accent = isChromaticSlot(primarySlot) ? base[primarySlot] : themeAccent;
  if (!accent) return;

  const foreground = contrastForeground(accent, base[7]!, base[0]!);
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--sidebar-primary", accent);
  root.style.setProperty("--sidebar-ring", accent);
  root.style.setProperty("--primary-foreground", foreground);
  root.style.setProperty("--sidebar-primary-foreground", foreground);
}
