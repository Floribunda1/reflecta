import { useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import { Input } from "@reflecta/ui/components/input";
import { cn } from "@reflecta/ui/lib/utils";
import { chromaticSwatches, type ChromaticSlot } from "@reflecta/ui/styles/apply-ghostty-scheme";
import {
  DEFAULT_GHOSTTY_SCHEME,
  PAIRED_THEMES,
  type PairedGhosttyTheme,
} from "@reflecta/ui/styles/ghostty-themes";
import { useThemeStore } from "./theme-store";

function PreviewSwatch({ base, accent }: { base: readonly string[]; accent: string }) {
  return (
    <div
      className="flex h-10 items-center gap-1 rounded-md border border-border px-2"
      style={{ backgroundColor: base[0], color: base[5] }}
    >
      <span className="truncate text-body-small font-medium">Aa</span>
      <span className="ml-auto flex shrink-0 gap-1">
        {[base[5], accent, base[8], base[11]].map((color, index) => (
          <span key={index} className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
        ))}
      </span>
    </div>
  );
}

function SlotSwatch({
  selected,
  light,
  dark,
  label,
  testId,
  onSelect,
}: {
  selected: boolean;
  light: string;
  dark: string;
  label: string;
  testId: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onSelect}
      className={cn(
        "size-4 overflow-hidden rounded-full border",
        selected ? "border-foreground ring-2 ring-ring" : "border-border hover:border-foreground",
      )}
    >
      <span className="block h-1/2" style={{ backgroundColor: light }} />
      <span className="block h-1/2" style={{ backgroundColor: dark }} />
    </button>
  );
}

function ThemeCard({
  theme,
  active,
  primarySlot,
  onSelectTheme,
  onSelectSlot,
}: {
  theme: PairedGhosttyTheme;
  active: boolean;
  primarySlot: ChromaticSlot | undefined;
  onSelectTheme: () => void;
  onSelectSlot: (slot: ChromaticSlot | null) => void;
}) {
  const lightAccent =
    primarySlot != null ? (theme.light[primarySlot] ?? theme.lightAccent) : theme.lightAccent;
  const darkAccent =
    primarySlot != null ? (theme.dark[primarySlot] ?? theme.darkAccent) : theme.darkAccent;
  const swatches = chromaticSwatches(theme);

  return (
    <div
      data-testid={`theme-option-${theme.name}`}
      className={cn(
        "grid min-w-0 gap-2 rounded-lg border p-2.5 transition-colors",
        active ? "border-primary bg-muted" : "border-border hover:bg-muted",
      )}
    >
      <button type="button" onClick={onSelectTheme} className="grid min-w-0 gap-2 text-left">
        <div className="grid gap-1">
          <PreviewSwatch base={theme.light} accent={lightAccent} />
          <PreviewSwatch base={theme.dark} accent={darkAccent} />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">{theme.name}</span>
          {active ? <Check size={14} className="ml-auto shrink-0 text-primary" /> : null}
        </div>
      </button>
      <div
        className="flex flex-wrap items-center gap-1"
        role="group"
        aria-label={`${theme.name} 主色`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-testid={`theme-primary-slot-${theme.name}-default`}
          aria-label={`${theme.name} 恢复默认主色`}
          title="恢复默认主色"
          onClick={() => onSelectSlot(null)}
        >
          <RotateCcw />
        </Button>
        {swatches.map((swatch) => (
          <SlotSwatch
            key={swatch.slot}
            selected={active && primarySlot === swatch.slot}
            light={swatch.light}
            dark={swatch.dark}
            label={`${theme.name} ${swatch.key}`}
            testId={`theme-primary-slot-${theme.name}-${swatch.key}`}
            onSelect={() => onSelectSlot(swatch.slot)}
          />
        ))}
      </div>
    </div>
  );
}

export function ThemeSection() {
  const scheme = useThemeStore((state) => state.scheme);
  const setScheme = useThemeStore((state) => state.setScheme);
  const primarySlots = useThemeStore((state) => state.primarySlots);
  const setPrimarySlot = useThemeStore((state) => state.setPrimarySlot);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matched = keyword
      ? PAIRED_THEMES.filter((theme) => theme.name.toLowerCase().includes(keyword))
      : PAIRED_THEMES;
    return [...matched].sort((left, right) => {
      if (left.name === DEFAULT_GHOSTTY_SCHEME) return -1;
      if (right.name === DEFAULT_GHOSTTY_SCHEME) return 1;
      return 0;
    });
  }, [query]);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold">主题</h3>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Ghostty 亮暗配对主题，明暗跟随系统。
          </p>
        </div>

        <Input
          data-testid="theme-search"
          placeholder="搜索主题…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((theme) => (
            <ThemeCard
              key={theme.name}
              theme={theme}
              primarySlot={primarySlots[theme.name]}
              active={scheme === theme.name}
              onSelectTheme={() => setScheme(theme.name)}
              onSelectSlot={(slot) => setPrimarySlot(theme.name, slot)}
            />
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">没有匹配的主题</p>
        ) : null}
      </section>
    </div>
  );
}
