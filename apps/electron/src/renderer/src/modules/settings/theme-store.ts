import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_PRIMARY_SLOT,
  isChromaticSlot,
  type ChromaticSlot,
} from "@reflecta/ui/styles/apply-ghostty-scheme";
import { DEFAULT_GHOSTTY_SCHEME } from "@reflecta/ui/styles/ghostty-themes";

/**
 * 主题偏好（外观设置）。
 *
 * - scheme：配对 Ghostty 主题名（默认 Apple System Colors）。
 * - primarySlots：每个主题各自的 base08–0F 覆盖；缺省则用该主题 cursor-color。
 *   出厂给 Apple System Colors 预置 base0D。
 *
 * 明暗不手动选择，始终跟随系统（next-themes resolvedTheme）。
 */
type ThemeState = {
  scheme: string;
  primarySlots: Record<string, ChromaticSlot>;
  setScheme: (scheme: string) => void;
  setPrimarySlot: (scheme: string, slot: ChromaticSlot | null) => void;
};

type PersistedThemeState = Partial<ThemeState> & { primarySlot?: unknown };

function resolveScheme(value: unknown): string {
  return typeof value === "string" && value ? value : DEFAULT_GHOSTTY_SCHEME;
}

function resolvePrimarySlots(stored: PersistedThemeState | undefined, scheme: string) {
  if (stored?.primarySlots && typeof stored.primarySlots === "object") {
    const next: Record<string, ChromaticSlot> = {};
    for (const [name, slot] of Object.entries(stored.primarySlots)) {
      if (isChromaticSlot(slot)) next[name] = slot;
    }
    return next;
  }
  if (isChromaticSlot(stored?.primarySlot)) return { [scheme]: stored.primarySlot };
  return { [DEFAULT_GHOSTTY_SCHEME]: DEFAULT_PRIMARY_SLOT };
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      scheme: DEFAULT_GHOSTTY_SCHEME,
      primarySlots: { [DEFAULT_GHOSTTY_SCHEME]: DEFAULT_PRIMARY_SLOT },
      setScheme: (scheme) => set({ scheme }),
      setPrimarySlot: (scheme, slot) =>
        set((state) => {
          const primarySlots = { ...state.primarySlots };
          if (isChromaticSlot(slot)) primarySlots[scheme] = slot;
          else delete primarySlots[scheme];
          return { scheme, primarySlots };
        }),
    }),
    {
      name: "reflecta-theme",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const stored = persisted as PersistedThemeState | undefined;
        const scheme = resolveScheme(stored?.scheme);
        return {
          ...current,
          scheme,
          primarySlots: resolvePrimarySlots(stored, scheme),
        };
      },
    },
  ),
);
