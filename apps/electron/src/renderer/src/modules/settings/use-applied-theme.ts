import { useEffect } from "react";
import { useTheme } from "next-themes";
import { applyGhosttyScheme } from "@reflecta/ui/styles/apply-ghostty-scheme";
import { DEFAULT_GHOSTTY_SCHEME, PAIRED_THEMES } from "@reflecta/ui/styles/ghostty-themes";
import { useThemeStore } from "./theme-store";

function resolvePairedTheme(scheme: string) {
  return (
    PAIRED_THEMES.find((item) => item.name === scheme) ??
    PAIRED_THEMES.find((item) => item.name === DEFAULT_GHOSTTY_SCHEME)
  );
}

/**
 * 把主题偏好应用到 <html>：按系统明暗注入 --base00~0F，
 * 主色用该主题记下的 base08–0F；没有记录则用主题自带 cursor-color。
 */
export function useAppliedTheme() {
  const scheme = useThemeStore((state) => state.scheme);
  const primarySlots = useThemeStore((state) => state.primarySlots);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    applyGhosttyScheme(
      document.documentElement,
      resolvePairedTheme(scheme),
      resolvedTheme === "dark" ? "dark" : "light",
      primarySlots[scheme] ?? null,
    );
  }, [scheme, primarySlots, resolvedTheme]);
}
