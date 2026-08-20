import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { kvsRuntime, runAtom } from "@renderer/lib/atoms";
import {
  CHROMATIC_SLOTS,
  DEFAULT_PRIMARY_SLOT,
  type ChromaticSlot,
} from "@reflecta/ui/styles/apply-ghostty-scheme";
import { DEFAULT_GHOSTTY_SCHEME } from "@reflecta/ui/styles/ghostty-themes";

/**
 * 主题偏好（外观设置），迁移到 Effect atoms + `Atom.kvs`（localStorage 持久化）。
 *
 * - scheme：配对 Ghostty 主题名（默认 Apple System Colors）。
 * - primarySlots：每个主题各自的 base08–0F 覆盖；缺省则用该主题 cursor-color。
 *   出厂给 Apple System Colors 预置 base0D。
 *
 * 明暗不手动选择，始终跟随系统（next-themes resolvedTheme）。
 *
 * Schema 保留真类型约束：primarySlots 的值必须是 8..15 的字面量联合（`ChromaticSlot`）。
 */
export type ThemeState = {
  scheme: string;
  primarySlots: Record<string, ChromaticSlot>;
};

export type ThemeActions = {
  setScheme: (scheme: string) => void;
  setPrimarySlot: (scheme: string, slot: ChromaticSlot | null) => void;
};

export type ThemeStore = ThemeState & ThemeActions;

export const initialThemeState: ThemeState = {
  scheme: DEFAULT_GHOSTTY_SCHEME,
  primarySlots: { [DEFAULT_GHOSTTY_SCHEME]: DEFAULT_PRIMARY_SLOT },
};

/** slot 字面量联合（8..15），避免把 primarySlots 打平成 numeric。 */
const chromaticSlot = S.Union(CHROMATIC_SLOTS.map((n) => S.Literal(n)));
const ThemeSchema = S.Struct({
  scheme: S.String,
  primarySlots: S.Record(S.String, chromaticSlot),
});

/** 持久化 theme atom（localStorage key：reflecta-theme）。 */
export const themeAtom: Atom.Writable<ThemeState, ThemeState> = Atom.keepAlive(
  Atom.kvs({
    runtime: kvsRuntime,
    key: "reflecta-theme",
    schema: ThemeSchema,
    defaultValue: () => initialThemeState,
  }),
);

export const themeActions: ThemeActions = {
  setScheme: (scheme) => runAtom(Atom.update(themeAtom, (state) => ({ ...state, scheme }))),
  setPrimarySlot: (scheme, slot) =>
    runAtom(
      Atom.update(themeAtom, (state) => {
        const primarySlots = { ...state.primarySlots };
        if (slot === null) delete primarySlots[scheme];
        else primarySlots[scheme] = slot;
        return { ...state, scheme, primarySlots };
      }),
    ),
};

/** 命令式读当前主题（getState 等价）。 */
export const readThemeState = (): ThemeState => runAtom(Atom.get(themeAtom));
